import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

import { ipcMain, BrowserWindow } from 'electron';
import { iconLogger } from '@common/logger';

import { IconProgress } from '../../common/types';
import { FaviconService } from '../services/faviconService';

const extractFileIcon = require('extract-file-icon');
const { shell } = require('electron');

// FaviconServiceのインスタンスを保持
let faviconService: FaviconService;

// メインウィンドウへの参照を保持
let mainWindow: BrowserWindow | null = null;

const execAsync = promisify(exec);

/**
 * 進捗状況をレンダラープロセスに送信する
 */
function sendProgressUpdate(eventType: 'start' | 'update' | 'complete', progress: IconProgress) {
  if (mainWindow) {
    mainWindow.webContents.send(`icon-progress-${eventType}`, progress);
  }
}

/**
 * 環境変数を展開する共通関数
 * @param path 環境変数を含む可能性があるパス
 * @returns 環境変数が展開されたパス
 */
function expandEnvironmentVariables(path: string): string {
  return path.replace(/%([^%]+)%/g, (_, envVar) => {
    return process.env[envVar] || _;
  });
}

/**
 * 指定されたURLのファビコンを取得する（FaviconServiceへの委譲）
 * FaviconServiceのインスタンスを管理し、ファビコンの取得処理を実行する
 *
 * @param url - ファビコンを取得するURL
 * @param faviconsFolder - ファビコンキャッシュフォルダのパス
 * @returns base64エンコードされたファビコンデータURL、失敗時はnull
 */
async function fetchFavicon(url: string, faviconsFolder: string): Promise<string | null> {
  if (!faviconService) {
    faviconService = new FaviconService(faviconsFolder);
  }

  return await faviconService.fetchFavicon(url);
}

/**
 * ショートカットファイル(.lnk)からカスタムアイコンを抽出してキャッシュに保存する
 * 最初に.lnkファイル自体からアイコンを抽出し、失敗した場合はターゲットファイルからの抽出にフォールバックする
 *
 * @param lnkPath - ショートカットファイルのパス
 * @param iconsFolder - アイコンキャッシュフォルダのパス
 * @returns base64エンコードされたアイコンデータURL、失敗時はnull
 */
async function extractShortcutIcon(lnkPath: string, iconsFolder: string): Promise<string | null> {
  try {
    // ファイルが存在するか確認
    if (!fs.existsSync(lnkPath)) {
      iconLogger.error(`ショートカットファイルが見つかりません: ${lnkPath}`);
      return null;
    }

    // ショートカット専用のキャッシュファイル名を生成
    const shortcutName = path.basename(lnkPath, '.lnk');
    const lnkIconName = `${shortcutName}_lnk_icon.png`;
    const lnkIconPath = path.join(iconsFolder, lnkIconName);

    // ショートカットのアイコンがすでにキャッシュされているか確認
    if (fs.existsSync(lnkIconPath)) {
      const cachedIcon = fs.readFileSync(lnkIconPath);
      const base64 = cachedIcon.toString('base64');
      iconLogger.info(`ショートカットのキャッシュアイコンを使用: ${lnkPath} -> ${lnkIconPath}`);
      return `data:image/png;base64,${base64}`;
    }

    // 1. ショートカットの詳細を取得してカスタムアイコンパスをチェック
    iconLogger.info(`ショートカットの詳細情報を取得: ${lnkPath}`);

    const shortcutDetails = shell.readShortcutLink(lnkPath);

    // カスタムアイコンが設定されている場合、そのアイコンファイルを直接読み込み
    if (shortcutDetails.icon) {
      // 環境変数を展開
      const expandedIconPath = expandEnvironmentVariables(shortcutDetails.icon);

      if (fs.existsSync(expandedIconPath)) {
        iconLogger.info(`カスタムアイコンファイルを発見: ${expandedIconPath}`);

        try {
          // アイコンファイル（.ico）を直接読み込み
          if (expandedIconPath.toLowerCase().endsWith('.ico')) {
            // ICOファイルをPNGに変換するため、extract-file-iconでアイコンファイルから抽出
            const extractedIconBuffer = extractFileIcon(expandedIconPath, 32);

            if (extractedIconBuffer && extractedIconBuffer.length > 0) {
              // ショートカット専用キャッシュに保存
              fs.writeFileSync(lnkIconPath, extractedIconBuffer);

              const base64 = extractedIconBuffer.toString('base64');
              iconLogger.info(
                `カスタムアイコンファイルからアイコンを抽出成功: ${expandedIconPath}`
              );
              return `data:image/png;base64,${base64}`;
            }
          }
        } catch (error) {
          iconLogger.error(`カスタムアイコンファイルの読み込みエラー`, {
            iconPath: expandedIconPath,
            error,
          });
        }
      } else {
        iconLogger.warn(`カスタムアイコンファイルが見つからない: ${expandedIconPath}`);
      }
    }

    // 2. フォールバック：.lnkファイル自体からアイコンを抽出を試行
    iconLogger.info(`ショートカットファイル自体からアイコン抽出を開始: ${lnkPath}`);
    const shortcutIconBuffer = extractFileIcon(lnkPath, 32);

    if (shortcutIconBuffer && shortcutIconBuffer.length > 0) {
      // ショートカット専用キャッシュに保存
      fs.writeFileSync(lnkIconPath, shortcutIconBuffer);

      const base64 = shortcutIconBuffer.toString('base64');
      iconLogger.info(`ショートカットファイルからアイコンを抽出成功: ${lnkPath}`);
      return `data:image/png;base64,${base64}`;
    }

    // 3. 最終フォールバック：ターゲットファイルからアイコンを抽出
    iconLogger.info(
      `ショートカットファイルからの抽出に失敗、ターゲットからの抽出を試行: ${lnkPath}`
    );

    if (shortcutDetails && shortcutDetails.target && fs.existsSync(shortcutDetails.target)) {
      const targetIcon = await extractIcon(shortcutDetails.target, iconsFolder);
      if (targetIcon) {
        iconLogger.info(
          `ターゲットファイルからアイコンを抽出成功: ${lnkPath} -> ${shortcutDetails.target}`
        );
        return targetIcon;
      }
    }

    iconLogger.warn(`ショートカットとターゲットの両方からアイコン抽出に失敗: ${lnkPath}`);
    return null;
  } catch (error) {
    iconLogger.error(`ショートカットアイコンの抽出に失敗しました: ${lnkPath}`, { error });
    return null;
  }
}

/**
 * 実行ファイルからアイコンを抽出してキャッシュに保存する
 * extract-file-iconライブラリを使用してWindowsの実行ファイルからアイコンを抽出し、PNGとしてキャッシュする
 *
 * @param filePath - アイコンを抽出するファイルのパス
 * @param iconsFolder - アイコンキャッシュフォルダのパス
 * @returns base64エンコードされたアイコンデータURL、失敗時はnull
 */
async function extractIcon(filePath: string, iconsFolder: string): Promise<string | null> {
  try {
    // ファイルが存在するか確認
    if (!fs.existsSync(filePath)) {
      iconLogger.error(`ファイルが見つかりません: ${filePath}`);
      return null;
    }

    // .lnkファイルの場合は専用関数を使用
    if (filePath.toLowerCase().endsWith('.lnk')) {
      iconLogger.info(`ショートカットファイルを検出、専用処理を実行: ${filePath}`);
      return await extractShortcutIcon(filePath, iconsFolder);
    }

    // キャッシュ用ファイル名を生成
    const iconName = path.basename(filePath, path.extname(filePath)) + '_icon.png';
    const iconPath = path.join(iconsFolder, iconName);

    // アイコンがすでにキャッシュされているか確認
    if (fs.existsSync(iconPath)) {
      const cachedIcon = fs.readFileSync(iconPath);
      const base64 = cachedIcon.toString('base64');
      return `data:image/png;base64,${base64}`;
    }

    // アイコンを抽出
    const iconBuffer = extractFileIcon(filePath, 32);

    if (iconBuffer && iconBuffer.length > 0) {
      // キャッシュに保存
      fs.writeFileSync(iconPath, iconBuffer);

      // base64データURLに変換
      const base64 = iconBuffer.toString('base64');
      return `data:image/png;base64,${base64}`;
    }

    return null;
  } catch (error) {
    iconLogger.error(`アイコンの抽出に失敗しました: ${filePath}`, { error });
    return null;
  }
}

async function extractCustomUriIcon(uri: string, iconsFolder: string): Promise<string | null> {
  try {
    // URIスキーマを抽出
    const schemeMatch = uri.match(/^([^:]+):/);
    if (!schemeMatch) {
      return null;
    }

    const scheme = schemeMatch[1];

    // キャッシュファイル名を生成
    const iconName = `uri_${scheme}_icon.png`;
    const iconPath = path.join(iconsFolder, iconName);

    // アイコンがすでにキャッシュされているか確認
    if (fs.existsSync(iconPath)) {
      const cachedIcon = fs.readFileSync(iconPath);
      const base64 = cachedIcon.toString('base64');
      return `data:image/png;base64,${base64}`;
    }

    // レジストリからハンドラーアプリケーションを取得
    const handlerPath = await getUriSchemeHandler(scheme);
    if (!handlerPath) {
      return null;
    }

    // ハンドラーアプリケーションからアイコンを抽出
    const iconBuffer = extractFileIcon(handlerPath, 32);

    if (iconBuffer && iconBuffer.length > 0) {
      // キャッシュに保存
      fs.writeFileSync(iconPath, iconBuffer);

      // base64データURLに変換
      const base64 = iconBuffer.toString('base64');
      return `data:image/png;base64,${base64}`;
    }

    return null;
  } catch (error) {
    iconLogger.error(`カスタムURIアイコンの抽出に失敗しました: ${uri}`, { error });
    return null;
  }
}

/**
 * ファイル拡張子に基づいてアイコンを抽出し、キャッシュに保存する
 * URIスキーマやファイルパスから拡張子を取得し、関連付けられたアプリケーションのアイコンを取得する
 * レジストリ検索やサンプルファイル作成による高度なアイコン抽出機能を提供する
 *
 * @param filePath - ファイルパスまたはURI（http://example.com/file.pdfなど）
 * @param extensionsFolder - 拡張子アイコンキャッシュフォルダのパス
 * @returns base64エンコードされたアイコンデータURL、失敗時はnull
 * @throws アイコン抽出エラー、一時ファイル作成エラー
 *
 * @example
 * const iconUrl = await extractFileIconByExtension('document.pdf', '/cache/extensions');
 * // 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
 */
async function extractFileIconByExtension(
  filePath: string,
  extensionsFolder: string
): Promise<string | null> {
  try {
    let fileExtension: string;

    // URIスキーマの場合は特別処理
    if (filePath.includes('://')) {
      fileExtension = extractExtensionFromUri(filePath);
    } else {
      fileExtension = path.extname(filePath).toLowerCase();
    }

    if (!fileExtension) {
      iconLogger.info(`拡張子がありません: ${filePath}`);
      return null;
    }

    // 拡張子ベースのキャッシュファイル名を生成
    const extensionName = fileExtension.replace('.', '');
    const iconName = `ext_${extensionName}_icon.png`;
    const iconPath = path.join(extensionsFolder, iconName);

    // アイコンがすでにキャッシュされているか確認
    if (fs.existsSync(iconPath)) {
      const cachedIcon = fs.readFileSync(iconPath);
      const base64 = cachedIcon.toString('base64');
      return `data:image/png;base64,${base64}`;
    }

    // 拡張子に対応するダミーファイルを作成してアイコンを取得
    const tempFilePath = createTempFileForExtension(extensionName);

    try {
      // extract-file-iconを使用してアイコンを取得
      const iconBuffer = extractFileIcon(tempFilePath, 32);

      if (iconBuffer && iconBuffer.length > 0) {
        // キャッシュに保存
        fs.writeFileSync(iconPath, iconBuffer);

        // base64データURLに変換
        const base64 = iconBuffer.toString('base64');
        return `data:image/png;base64,${base64}`;
      }
    } finally {
      // 一時ファイルを削除
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

    return null;
  } catch (error) {
    iconLogger.error(`拡張子ベースのアイコン抽出に失敗しました: ${filePath}`, { error });
    return null;
  }
}

async function getUriSchemeHandler(scheme: string): Promise<string | null> {
  if (process.platform !== 'win32') {
    return null;
  }

  try {
    // スキーマからコロンとスラッシュを除去
    const cleanScheme = scheme.replace(/[:\\/]/g, '');

    // レジストリからスキーマハンドラーを取得
    await execAsync(`reg query "HKEY_CLASSES_ROOT\\${cleanScheme}" /ve`, {
      encoding: 'utf8',
    });

    // レジストリから実行ファイルパスを取得
    const { stdout: commandStdout } = await execAsync(
      `reg query "HKEY_CLASSES_ROOT\\${cleanScheme}\\shell\\open\\command" /ve`,
      { encoding: 'utf8' }
    );

    // 実行ファイルパスを抽出
    const matches = commandStdout.match(/"([^"]+\.exe)"|([^\s]+\.exe)/i);
    if (matches) {
      const exePath = matches[1] || matches[2];
      // 環境変数を展開
      const expandedPath = expandEnvironmentVariables(exePath);

      if (fs.existsSync(expandedPath)) {
        return expandedPath;
      }
    }

    return null;
  } catch {
    // レジストリエントリが存在しない場合はエラーになるが、これは正常
    return null;
  }
}

function extractExtensionFromUri(uri: string): string {
  try {
    // URIからファイル名部分を抽出
    // 例: ms-excel:ofe|ofc|u|https://...Book%204.xlsx -> .xlsx
    // 例: ms-excel:ofe|ofc|u|https://...Book%204.xlsx?web=1 -> .xlsx

    // パイプ区切りの最後の部分（URL部分）を取得
    const parts = uri.split('|');
    const lastPart = parts[parts.length - 1];

    // URLデコードしてファイル名を取得
    const decodedUrl = decodeURIComponent(lastPart);

    // パス部分からファイル名を抽出
    let fileName = decodedUrl.split('/').pop() || '';

    // クエリパラメータとフラグメントを除去
    fileName = fileName.split('?')[0].split('#')[0];

    // 拡張子を抽出
    const extensionMatch = fileName.match(/\.[^.]+$/);
    return extensionMatch ? extensionMatch[0].toLowerCase() : '';
  } catch (error) {
    iconLogger.error(`URIから拡張子の抽出に失敗: ${uri}`, { error });
    return '';
  }
}

function createTempFileForExtension(extension: string): string {
  const tempDir = os.tmpdir();
  const tempFileName = `temp_icon_extract_${Date.now()}.${extension}`;
  const tempFilePath = path.join(tempDir, tempFileName);

  // 空のファイルを作成
  fs.writeFileSync(tempFilePath, '');

  return tempFilePath;
}

interface IconItem {
  type: string;
  path: string;
  originalPath?: string;
}

/**
 * 複数のアイテムのキャッシュされたアイコンを一括で読み込む
 * 各アイテムのタイプに応じて適切なキャッシュフォルダからアイコンを検索し、base64形式で返す
 * URL（ファビコン）、実行ファイル（直接アイコン）、拡張子ベース（関連付け）の3つの方法に対応
 *
 * @param items - アイコンを読み込むアイテムの配列
 * @param faviconsFolder - ファビコンキャッシュフォルダのパス
 * @param iconsFolder - アイコンキャッシュフォルダのパス
 * @param extensionsFolder - 拡張子アイコンキャッシュフォルダのパス
 * @returns パス（またはURL）をキーとするアイコンデータのマップ
 *
 * @example
 * const icons = await loadCachedIcons(
 *   [{ path: 'code.exe', type: 'app' }, { path: 'https://google.com', type: 'url' }],
 *   '/cache/favicons', '/cache/icons', '/cache/extensions'
 * );
 * // { 'code.exe': 'data:image/png;base64,...', 'https://google.com': 'data:image/png;base64,...' }
 */
async function loadCachedIcons(
  items: IconItem[],
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string
): Promise<Record<string, string>> {
  const iconCache: Record<string, string> = {};

  for (const item of items) {
    try {
      let iconPath: string | null = null;

      // URLの場合、キャッシュされたファビコンをチェック
      if (item.type === 'url' && item.path && item.path.includes('://')) {
        const domain = new URL(item.path).hostname;
        // 新しい64pxファイルを優先的にチェック
        const faviconPath64 = path.join(faviconsFolder, `${domain}_favicon_64.png`);
        const faviconPath32 = path.join(faviconsFolder, `${domain}_favicon_32.png`);

        if (fs.existsSync(faviconPath64)) {
          iconPath = faviconPath64;
        } else if (fs.existsSync(faviconPath32)) {
          iconPath = faviconPath32;
        }
      } else if (
        item.type === 'app' &&
        ((item.originalPath && item.originalPath.endsWith('.lnk')) ||
          (item.path && item.path.endsWith('.lnk')))
      ) {
        // ショートカットファイルの場合（展開済みアイテムまたは直接指定）
        // 元のショートカットパスを優先、なければ現在のパスを使用
        const shortcutPath =
          item.originalPath && item.originalPath.endsWith('.lnk') ? item.originalPath : item.path;

        const shortcutName = path.basename(shortcutPath, '.lnk');
        const lnkIconPath = path.join(iconsFolder, `${shortcutName}_lnk_icon.png`);
        const exeIconPath = path.join(iconsFolder, `${shortcutName}_icon.png`);

        if (fs.existsSync(lnkIconPath)) {
          iconPath = lnkIconPath;
        } else if (fs.existsSync(exeIconPath)) {
          iconPath = exeIconPath;
        }
      } else if (item.type === 'app' && item.path && item.path.endsWith('.exe')) {
        // .exeファイルの場合、アイコンをチェック
        const iconName = path.basename(item.path, '.exe') + '_icon.png';
        const exeIconPath = path.join(iconsFolder, iconName);
        if (fs.existsSync(exeIconPath)) {
          iconPath = exeIconPath;
        }
      } else if (item.type === 'customUri' && item.path) {
        // カスタムURIの場合、まずスキーマベースのアイコンをチェック
        const schemeMatch = item.path.match(/^([^:]+):/);
        if (schemeMatch) {
          const scheme = schemeMatch[1];
          const uriIconPath = path.join(iconsFolder, `uri_${scheme}_icon.png`);
          if (fs.existsSync(uriIconPath)) {
            iconPath = uriIconPath;
          }
        }

        // スキーマベースのアイコンがない場合、拡張子ベースのアイコンをチェック
        if (!iconPath) {
          const fileExtension = extractExtensionFromUri(item.path);
          if (fileExtension) {
            const extensionName = fileExtension.replace('.', '');
            const extensionIconPath = path.join(extensionsFolder, `ext_${extensionName}_icon.png`);
            if (fs.existsSync(extensionIconPath)) {
              iconPath = extensionIconPath;
            }
          }
        }
      } else if (item.type === 'file' && item.path) {
        // ファイルの場合、拡張子ベースのアイコンをチェック
        const fileExtension = path.extname(item.path).toLowerCase();
        if (fileExtension) {
          const extensionName = fileExtension.replace('.', '');
          const extensionIconPath = path.join(extensionsFolder, `ext_${extensionName}_icon.png`);
          if (fs.existsSync(extensionIconPath)) {
            iconPath = extensionIconPath;
          }
        }
      }

      if (iconPath) {
        const iconBuffer = fs.readFileSync(iconPath);
        const base64 = iconBuffer.toString('base64');
        iconCache[item.path] = `data:image/png;base64,${base64}`;
      }
    } catch (error) {
      iconLogger.error(`キャッシュされたアイコンの読み込みに失敗: ${item.path}`, { error });
    }
  }

  return iconCache;
}

/**
 * 複数のURLのファビコンを逐次取得し、進捗状況を報告する
 */
async function fetchFaviconsWithProgress(
  urls: string[],
  faviconsFolder: string
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};
  const total = urls.length;
  let current = 0;
  let errors = 0;
  const startTime = Date.now();

  // 進捗開始を通知
  sendProgressUpdate('start', {
    type: 'favicon',
    current: 0,
    total,
    currentItem: '',
    errors: 0,
    startTime,
    isComplete: false,
  });

  for (const url of urls) {
    try {
      // 現在の処理アイテムを通知
      sendProgressUpdate('update', {
        type: 'favicon',
        current,
        total,
        currentItem: url,
        errors,
        startTime,
        isComplete: false,
      });

      const favicon = await fetchFavicon(url, faviconsFolder);
      results[url] = favicon;

      current++;

      // 進捗更新を通知
      sendProgressUpdate('update', {
        type: 'favicon',
        current,
        total,
        currentItem: url,
        errors,
        startTime,
        isComplete: false,
      });
    } catch (error) {
      iconLogger.error(`ファビコン取得エラー: ${url}`, { error });
      results[url] = null;
      errors++;
      current++;
    }
  }

  // 進捗完了を通知
  sendProgressUpdate('complete', {
    type: 'favicon',
    current,
    total,
    currentItem: '',
    errors,
    startTime,
    isComplete: true,
  });

  return results;
}

/**
 * 複数のアイテムのアイコンを逐次抽出し、進捗状況を報告する
 */
async function extractIconsWithProgress(
  items: IconItem[],
  iconsFolder: string,
  extensionsFolder: string
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};
  const total = items.length;
  let current = 0;
  let errors = 0;
  const startTime = Date.now();

  // 進捗開始を通知
  sendProgressUpdate('start', {
    type: 'icon',
    current: 0,
    total,
    currentItem: '',
    errors: 0,
    startTime,
    isComplete: false,
  });

  for (const item of items) {
    try {
      // 現在の処理アイテムを通知
      sendProgressUpdate('update', {
        type: 'icon',
        current,
        total,
        currentItem: item.path,
        errors,
        startTime,
        isComplete: false,
      });

      let icon: string | null = null;

      if (item.type === 'app') {
        // ショートカットから展開されたアイテムの場合、元のショートカットファイルからアイコンを抽出
        if (item.originalPath && item.originalPath.endsWith('.lnk')) {
          icon = await extractIcon(item.originalPath, iconsFolder);
        }
        // 通常のアプリケーションファイル（.exe）またはショートカットファイル（.lnk）の場合
        else if (item.path.endsWith('.exe') || item.path.endsWith('.lnk')) {
          icon = await extractIcon(item.path, iconsFolder);
        }
      } else if (item.type === 'customUri') {
        // First try to extract icon from URI scheme handler
        icon = await extractCustomUriIcon(item.path, iconsFolder);
        // If scheme handler icon failed, fall back to file extension
        if (!icon) {
          icon = await extractFileIconByExtension(item.path, extensionsFolder);
        }
      } else if (item.type === 'file') {
        // Extract icon based on file extension
        icon = await extractFileIconByExtension(item.path, extensionsFolder);
      }
      // Skip URLs - favicons should only be fetched via the favicon button

      results[item.path] = icon;
      current++;

      // 進捗更新を通知
      sendProgressUpdate('update', {
        type: 'icon',
        current,
        total,
        currentItem: item.path,
        errors,
        startTime,
        isComplete: false,
      });
    } catch (error) {
      iconLogger.error(`アイコン抽出エラー: ${item.path}`, { error });
      results[item.path] = null;
      errors++;
      current++;
    }
  }

  // 進捗完了を通知
  sendProgressUpdate('complete', {
    type: 'icon',
    current,
    total,
    currentItem: '',
    errors,
    startTime,
    isComplete: true,
  });

  return results;
}

export function setupIconHandlers(
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string,
  getMainWindow?: () => BrowserWindow | null
) {
  // メインウィンドウの参照を設定
  if (getMainWindow) {
    mainWindow = getMainWindow();
  }

  ipcMain.handle('fetch-favicon', async (_event, url: string) => {
    return await fetchFavicon(url, faviconsFolder);
  });

  ipcMain.handle('extract-icon', async (_event, filePath: string) => {
    return await extractIcon(filePath, iconsFolder);
  });

  ipcMain.handle('extract-file-icon-by-extension', async (_event, filePath: string) => {
    return await extractFileIconByExtension(filePath, extensionsFolder);
  });

  ipcMain.handle('extract-custom-uri-icon', async (_event, uri: string) => {
    return await extractCustomUriIcon(uri, iconsFolder);
  });

  ipcMain.handle('load-cached-icons', async (_event, items: IconItem[]) => {
    return await loadCachedIcons(items, faviconsFolder, iconsFolder, extensionsFolder);
  });

  // 新しい一括処理API
  ipcMain.handle('fetch-favicons-with-progress', async (_event, urls: string[]) => {
    return await fetchFaviconsWithProgress(urls, faviconsFolder);
  });

  ipcMain.handle('extract-icons-with-progress', async (_event, items: IconItem[]) => {
    return await extractIconsWithProgress(items, iconsFolder, extensionsFolder);
  });
}
