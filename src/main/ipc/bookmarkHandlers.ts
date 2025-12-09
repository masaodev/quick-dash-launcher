import * as path from 'path';
import * as fs from 'fs';

import { ipcMain, dialog } from 'electron';
import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { MAX_BOOKMARK_FILE_SIZE } from '@common/constants';
import { SimpleBookmarkItem, BrowserInfo, BrowserProfile } from '@common/types';

/**
 * プロファイルフォルダからプロファイル名を取得する
 * @param profilePath - プロファイルフォルダのパス
 * @returns プロファイル名
 */
async function getProfileName(profilePath: string): Promise<string> {
  const prefsPath = path.join(profilePath, 'Preferences');
  try {
    const content = await fs.promises.readFile(prefsPath, 'utf-8');
    const prefs = JSON.parse(content);
    return prefs.profile?.name || path.basename(profilePath);
  } catch {
    return path.basename(profilePath);
  }
}

/**
 * ブラウザのユーザーデータフォルダからプロファイルを検出する
 * @param userDataPath - ユーザーデータフォルダのパス
 * @returns プロファイル情報の配列
 */
async function detectProfiles(userDataPath: string): Promise<BrowserProfile[]> {
  const profiles: BrowserProfile[] = [];

  try {
    const entries = await fs.promises.readdir(userDataPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Default または Profile N のフォルダを検出
      const isProfileFolder = entry.name === 'Default' || /^Profile \d+$/.test(entry.name);

      if (!isProfileFolder) continue;

      const profilePath = path.join(userDataPath, entry.name);
      const bookmarkPath = path.join(profilePath, 'Bookmarks');

      // Bookmarksファイルが存在するか確認
      if (!fs.existsSync(bookmarkPath)) continue;

      const profileName = await getProfileName(profilePath);

      profiles.push({
        id: entry.name,
        name: profileName,
        bookmarkPath: bookmarkPath,
      });
    }
  } catch (error) {
    dataLogger.warn({ userDataPath, error }, 'プロファイルの検出に失敗');
  }

  return profiles;
}

/**
 * インストール済みのブラウザ（Chrome/Edge）を検出する
 * @returns ブラウザ情報の配列
 */
export async function detectInstalledBrowsers(): Promise<BrowserInfo[]> {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    dataLogger.warn('LOCALAPPDATA環境変数が設定されていません');
    return [];
  }

  const browsers: BrowserInfo[] = [];

  // Chrome検出
  const chromeUserData = path.join(localAppData, 'Google', 'Chrome', 'User Data');
  if (fs.existsSync(chromeUserData)) {
    const profiles = await detectProfiles(chromeUserData);
    browsers.push({
      id: 'chrome',
      name: 'Google Chrome',
      installed: profiles.length > 0,
      profiles: profiles,
    });
  } else {
    browsers.push({
      id: 'chrome',
      name: 'Google Chrome',
      installed: false,
      profiles: [],
    });
  }

  // Edge検出
  const edgeUserData = path.join(localAppData, 'Microsoft', 'Edge', 'User Data');
  if (fs.existsSync(edgeUserData)) {
    const profiles = await detectProfiles(edgeUserData);
    browsers.push({
      id: 'edge',
      name: 'Microsoft Edge',
      installed: profiles.length > 0,
      profiles: profiles,
    });
  } else {
    browsers.push({
      id: 'edge',
      name: 'Microsoft Edge',
      installed: false,
      profiles: [],
    });
  }

  dataLogger.info(
    {
      browsers: browsers.map((b) => ({
        id: b.id,
        installed: b.installed,
        profileCount: b.profiles.length,
      })),
    },
    'ブラウザを検出しました'
  );

  return browsers;
}

/**
 * ブックマークファイルのパスが許可されたパスかどうかを検証する
 * @param filePath - 検証するファイルパス
 * @returns 許可されたパスならtrue
 */
function isValidBookmarkPath(filePath: string): boolean {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return false;

  const normalizedPath = path.normalize(filePath);
  const allowedPaths = [
    path.join(localAppData, 'Google', 'Chrome', 'User Data'),
    path.join(localAppData, 'Microsoft', 'Edge', 'User Data'),
  ];

  return allowedPaths.some((allowed) => normalizedPath.startsWith(allowed));
}

/**
 * ブラウザのブックマークJSONファイルをパースしてSimpleBookmarkItemの配列に変換する
 * @param filePath - ブックマークファイルのパス
 * @returns SimpleBookmarkItemの配列
 */
export async function parseBrowserBookmarks(filePath: string): Promise<SimpleBookmarkItem[]> {
  // セキュリティチェック：許可されたパス内かどうか確認
  if (!isValidBookmarkPath(filePath)) {
    throw new Error('許可されていないファイルパスです');
  }

  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');

    // ファイルサイズチェック
    if (content.length > MAX_BOOKMARK_FILE_SIZE) {
      throw new Error('ファイルサイズが大きすぎます');
    }

    const data = JSON.parse(content);

    // 構造の検証
    if (!data.roots || typeof data.roots !== 'object') {
      throw new Error('無効なブックマークファイル形式です');
    }

    const bookmarks: SimpleBookmarkItem[] = [];
    let index = 0;

    // 再帰的にブックマークを抽出
    function traverse(node: Record<string, unknown>) {
      if (node.type === 'url' && typeof node.url === 'string' && typeof node.name === 'string') {
        const url = node.url;
        // http/https のみ許可
        if (url.startsWith('http://') || url.startsWith('https://')) {
          bookmarks.push({
            id: `browser-bookmark-${index++}`,
            name: (node.name as string).trim() || url,
            url: url,
            checked: false,
          });
        }
      }
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child as Record<string, unknown>);
        }
      }
    }

    // roots内の各ノードを探索
    for (const key of ['bookmark_bar', 'other', 'synced']) {
      if (data.roots[key]) {
        traverse(data.roots[key] as Record<string, unknown>);
      }
    }

    dataLogger.info(
      { filePath, bookmarkCount: bookmarks.length },
      'ブラウザブックマークをパースしました'
    );

    return bookmarks;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('EBUSY') || error.message.includes('EACCES'))
    ) {
      throw new Error('ブラウザが起動中です。ブラウザを閉じてから再試行してください。');
    }
    dataLogger.error({ filePath, error }, 'ブラウザブックマークのパースに失敗');
    throw error;
  }
}

/**
 * HTMLブックマークファイルをパースしてSimpleBookmarkItemの配列に変換する
 * @param filePath - ブックマークファイルのパス
 * @returns SimpleBookmarkItemの配列
 */
export function parseBookmarkFile(filePath: string): SimpleBookmarkItem[] {
  try {
    const htmlContent = FileUtils.safeReadTextFile(filePath);
    if (!htmlContent) {
      throw new Error('ファイルの読み込みに失敗しました');
    }

    // 簡易的なHTMLパーサーでブックマークを抽出
    const bookmarks: SimpleBookmarkItem[] = [];

    // <A>タグを正規表現で抽出
    const linkRegex = /<A\s+[^>]*HREF="([^"]*)"[^>]*>([^<]*)<\/A>/gi;
    let match;
    let index = 0;

    while ((match = linkRegex.exec(htmlContent)) !== null) {
      const url = match[1];
      const name = match[2].trim();

      // URLが有効な場合のみ追加
      if (url && name && (url.startsWith('http://') || url.startsWith('https://'))) {
        bookmarks.push({
          id: `bookmark-${index}`,
          name: name,
          url: url,
          checked: false,
        });
        index++;
      }
    }

    return bookmarks;
  } catch (error) {
    dataLogger.error({ error }, 'ブックマークファイルのパースに失敗');
    throw error;
  }
}

/**
 * ブックマーク関連のIPCハンドラーを登録する
 */
export function setupBookmarkHandlers() {
  ipcMain.handle('select-bookmark-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'ブックマークファイルを選択',
      filters: [
        { name: 'HTML Files', extensions: ['html', 'htm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('parse-bookmark-file', async (_event, filePath: string) => {
    return parseBookmarkFile(filePath);
  });

  // ブラウザブックマーク直接インポートAPI
  ipcMain.handle('detect-installed-browsers', async () => {
    return await detectInstalledBrowsers();
  });

  ipcMain.handle('parse-browser-bookmarks', async (_event, filePath: string) => {
    return await parseBrowserBookmarks(filePath);
  });
}
