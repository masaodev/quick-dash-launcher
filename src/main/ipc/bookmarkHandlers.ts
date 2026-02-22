import * as path from 'path';
import * as fs from 'fs';

import { ipcMain, dialog } from 'electron';
import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { MAX_BOOKMARK_FILE_SIZE } from '@common/constants';
import { SimpleBookmarkItem, BrowserInfo, BrowserProfile } from '@common/types';
import type { BookmarkFolder, BookmarkWithFolder } from '@common/types/bookmarkAutoImport';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { EnvConfig } from '../config/envConfig.js';

/**
 * Chromeのプリファレンスファイルの型定義
 */
interface ChromePreferences {
  profile?: {
    name?: string;
  };
}

/**
 * ブラウザブックマークのノード型定義
 */
interface BookmarkNode {
  type?: string;
  url?: string;
  name?: string;
  children?: unknown[];
}

/**
 * ブラウザブックマークファイルのデータ構造
 */
interface BookmarkData {
  roots?: Record<string, unknown>;
}

const BOOKMARK_ROOT_KEYS = ['bookmark_bar', 'other', 'synced'] as const;

function isBookmarkNode(obj: unknown): obj is BookmarkNode {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (typeof (obj as BookmarkNode).type === 'string' ||
      typeof (obj as BookmarkNode).children !== 'undefined')
  );
}

/**
 * プロファイルフォルダからプロファイル名を取得する
 * @param profilePath - プロファイルフォルダのパス
 * @returns プロファイル名
 */
async function getProfileName(profilePath: string): Promise<string> {
  const prefsPath = path.join(profilePath, 'Preferences');
  try {
    const content = await fs.promises.readFile(prefsPath, 'utf-8');
    const prefs = JSON.parse(content) as ChromePreferences;
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
        displayName: profileName,
        bookmarkPath,
      });
    }
  } catch (error) {
    dataLogger.warn({ userDataPath, error }, 'プロファイルの検出に失敗');
  }

  return profiles;
}

/**
 * ブラウザ検出用の設定
 */
const BROWSER_CONFIGS = [
  { id: 'chrome', displayName: 'Google Chrome', pathSegments: ['Google', 'Chrome', 'User Data'] },
  { id: 'edge', displayName: 'Microsoft Edge', pathSegments: ['Microsoft', 'Edge', 'User Data'] },
] as const;

/**
 * インストール済みのブラウザ（Chrome/Edge）を検出する
 * @returns ブラウザ情報の配列
 */
export async function detectInstalledBrowsers(): Promise<BrowserInfo[]> {
  const localAppData = EnvConfig.localAppData;
  if (!localAppData) {
    dataLogger.warn('LOCALAPPDATA環境変数が設定されていません');
    return [];
  }

  const browsers: BrowserInfo[] = await Promise.all(
    BROWSER_CONFIGS.map(async (config) => {
      const userDataPath = path.join(localAppData, ...config.pathSegments);
      const profiles = fs.existsSync(userDataPath) ? await detectProfiles(userDataPath) : [];

      return {
        id: config.id,
        displayName: config.displayName,
        installed: profiles.length > 0,
        profiles,
      };
    })
  );

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
  const localAppData = EnvConfig.localAppData;
  if (!localAppData) return false;

  const normalizedPath = path.normalize(filePath);
  const allowedPaths = [
    path.join(localAppData, 'Google', 'Chrome', 'User Data'),
    path.join(localAppData, 'Microsoft', 'Edge', 'User Data'),
  ];

  return allowedPaths.some((allowed) => normalizedPath.startsWith(allowed));
}

/**
 * ブックマークファイルを読み込み、バリデーション済みのrootsオブジェクトを返す
 */
async function readAndValidateBookmarkFile(filePath: string): Promise<Record<string, unknown>> {
  if (!isValidBookmarkPath(filePath)) {
    throw new Error('許可されていないファイルパスです');
  }

  const content = await fs.promises.readFile(filePath, 'utf-8');
  if (content.length > MAX_BOOKMARK_FILE_SIZE) {
    throw new Error('ファイルサイズが大きすぎます');
  }

  const data = JSON.parse(content) as BookmarkData;
  if (!data.roots || typeof data.roots !== 'object') {
    throw new Error('無効なブックマークファイル形式です');
  }

  return data.roots;
}

/**
 * ブラウザのブックマークJSONファイルをパースしてSimpleBookmarkItemの配列に変換する
 * @param filePath - ブックマークファイルのパス
 * @returns SimpleBookmarkItemの配列
 */
export async function parseBrowserBookmarks(filePath: string): Promise<SimpleBookmarkItem[]> {
  try {
    const roots = await readAndValidateBookmarkFile(filePath);

    const bookmarks: SimpleBookmarkItem[] = [];
    let index = 0;

    // 再帰的にブックマークを抽出
    function traverse(node: unknown) {
      if (!isBookmarkNode(node)) return;

      if (node.type === 'url' && typeof node.url === 'string' && typeof node.name === 'string') {
        const url = node.url;
        // http/https のみ許可
        if (url.startsWith('http://') || url.startsWith('https://')) {
          bookmarks.push({
            id: `browser-bookmark-${index++}`,
            displayName: node.name.trim() || url,
            url: url,
            checked: false,
          });
        }
      }
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }

    // roots内の各ノードを探索
    for (const key of BOOKMARK_ROOT_KEYS) {
      if (roots[key]) {
        traverse(roots[key]);
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
 * ブラウザのブックマークJSONファイルからフォルダ構造のみを返す（ツリーUI用）
 * @param filePath - ブックマークファイルのパス
 * @returns BookmarkFolder配列
 */
export async function parseBrowserBookmarkFolders(filePath: string): Promise<BookmarkFolder[]> {
  const roots = await readAndValidateBookmarkFile(filePath);
  const folders: BookmarkFolder[] = [];

  function traverseFolders(node: unknown, currentPath: string): BookmarkFolder | null {
    if (!isBookmarkNode(node)) return null;

    // フォルダノードの場合
    if (node.children && Array.isArray(node.children)) {
      const name = node.name || path.basename(currentPath) || '';
      let bookmarkCount = 0;
      const children: BookmarkFolder[] = [];

      for (const child of node.children) {
        if (!isBookmarkNode(child)) continue;

        if (child.type === 'url') {
          bookmarkCount++;
        } else if (child.children && Array.isArray(child.children)) {
          const childName = child.name || '';
          const childPath = currentPath ? `${currentPath}/${childName}` : childName;
          const childFolder = traverseFolders(child, childPath);
          if (childFolder) {
            children.push(childFolder);
          }
        }
      }

      return {
        path: currentPath,
        name,
        children,
        bookmarkCount,
      };
    }

    return null;
  }

  for (const key of BOOKMARK_ROOT_KEYS) {
    if (roots[key]) {
      const folder = traverseFolders(roots[key], key);
      if (folder) {
        folders.push(folder);
      }
    }
  }

  return folders;
}

/**
 * ブラウザのブックマークJSONファイルをフォルダパス付きでパースする（フィルタ用）
 * @param filePath - ブックマークファイルのパス
 * @returns BookmarkWithFolder配列
 */
export async function parseBrowserBookmarksWithFolders(
  filePath: string
): Promise<BookmarkWithFolder[]> {
  const roots = await readAndValidateBookmarkFile(filePath);
  const bookmarks: BookmarkWithFolder[] = [];

  function traverse(node: unknown, folderPath: string) {
    if (!isBookmarkNode(node)) return;

    if (node.type === 'url' && typeof node.url === 'string' && typeof node.name === 'string') {
      const url = node.url;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        bookmarks.push({
          displayName: node.name.trim() || url,
          url,
          folderPath,
        });
      }
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        if (!isBookmarkNode(child)) continue;

        if (child.type === 'url') {
          traverse(child, folderPath);
        } else if (child.children) {
          const childName = child.name || '';
          const childPath = folderPath ? `${folderPath}/${childName}` : childName;
          traverse(child, childPath);
        }
      }
    }
  }

  for (const key of BOOKMARK_ROOT_KEYS) {
    if (roots[key]) {
      traverse(roots[key], key);
    }
  }

  return bookmarks;
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
          displayName: name,
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
  ipcMain.handle(IPC_CHANNELS.SELECT_BOOKMARK_FILE, async () => {
    const result = await dialog.showOpenDialog({
      title: 'ブックマークファイルを選択',
      filters: [
        { name: 'HTML Files', extensions: ['html', 'htm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(IPC_CHANNELS.PARSE_BOOKMARK_FILE, (_event, filePath: string) =>
    parseBookmarkFile(filePath)
  );

  // ブラウザブックマーク直接インポートAPI
  ipcMain.handle(IPC_CHANNELS.DETECT_INSTALLED_BROWSERS, detectInstalledBrowsers);

  ipcMain.handle(IPC_CHANNELS.PARSE_BROWSER_BOOKMARKS, (_event, filePath: string) =>
    parseBrowserBookmarks(filePath)
  );
}
