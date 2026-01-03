import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as crypto from 'crypto';

import { ipcMain, BrowserWindow, dialog, shell } from 'electron';
import { iconLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { PathUtils } from '@common/utils/pathUtils';
import extractFileIcon from 'extract-file-icon';

import { CombinedProgressManager } from '../utils/progressManager';
import { FaviconService } from '../services/faviconService';
import { IconService } from '../services/iconService.js';
import PathManager from '../config/pathManager.js';

// FaviconServiceのインスタンスを保持
let faviconService: FaviconService;

// メインウィンドウへの参照を保持
let mainWindow: BrowserWindow | null = null;

const execAsync = promisify(exec);

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
    if (!FileUtils.exists(lnkPath)) {
      iconLogger.error(`ショートカットファイルが見つかりません: ${lnkPath}`);
      return null;
    }

    // ショートカット専用のキャッシュファイル名を生成
    const shortcutName = path.basename(lnkPath, '.lnk');
    const lnkIconName = `${shortcutName}_lnk_icon.png`;
    const lnkIconPath = path.join(iconsFolder, lnkIconName);

    // ショートカットのアイコンがすでにキャッシュされているか確認
    const cachedIcon = FileUtils.readCachedBinaryAsBase64(lnkIconPath);
    if (cachedIcon) {
      iconLogger.info(`ショートカットのキャッシュアイコンを使用: ${lnkPath} -> ${lnkIconPath}`);
      return cachedIcon;
    }

    // 1. ショートカットの詳細を取得してカスタムアイコンパスをチェック
    iconLogger.info(`ショートカットの詳細情報を取得: ${lnkPath}`);

    const shortcutDetails = shell.readShortcutLink(lnkPath);

    // カスタムアイコンが設定されている場合、そのアイコンファイルを直接読み込み
    if (shortcutDetails.icon) {
      // 環境変数を展開
      const expandedIconPath = expandEnvironmentVariables(shortcutDetails.icon);

      if (FileUtils.exists(expandedIconPath)) {
        iconLogger.info(`カスタムアイコンファイルを発見: ${expandedIconPath}`);

        try {
          // アイコンファイル（.ico）を直接読み込み
          if (expandedIconPath.toLowerCase().endsWith('.ico')) {
            // ICOファイルをPNGに変換するため、extract-file-iconでアイコンファイルから抽出
            const extractedIconBuffer = extractFileIcon(expandedIconPath, 32);

            if (extractedIconBuffer && extractedIconBuffer.length > 0) {
              // ショートカット専用キャッシュに保存
              FileUtils.writeBinaryFile(lnkIconPath, extractedIconBuffer);

              iconLogger.info(
                `カスタムアイコンファイルからアイコンを抽出成功: ${expandedIconPath}`
              );
              return FileUtils.bufferToBase64DataUrl(extractedIconBuffer);
            }
          }
        } catch (error) {
          iconLogger.error(
            { iconPath: expandedIconPath, error },
            'カスタムアイコンファイルの読み込みエラー'
          );
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
      FileUtils.writeBinaryFile(lnkIconPath, shortcutIconBuffer);

      iconLogger.info(`ショートカットファイルからアイコンを抽出成功: ${lnkPath}`);
      return FileUtils.bufferToBase64DataUrl(shortcutIconBuffer);
    }

    // 3. 最終フォールバック：ターゲットファイルからアイコンを抽出
    iconLogger.info(
      `ショートカットファイルからの抽出に失敗、ターゲットからの抽出を試行: ${lnkPath}`
    );

    if (shortcutDetails && shortcutDetails.target && FileUtils.exists(shortcutDetails.target)) {
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
    iconLogger.error({ lnkPath, error }, 'ショートカットアイコンの抽出に失敗しました');
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
export async function extractIcon(filePath: string, iconsFolder: string): Promise<string | null> {
  try {
    let resolvedPath = filePath;

    // ファイルが存在するか確認、存在しない場合はパスを解決
    if (!FileUtils.exists(filePath)) {
      // ファイルが見つからない場合、PATHから検索を試みる
      if (process.platform === 'win32' && !filePath.includes('\\') && !filePath.includes('/')) {
        iconLogger.info(`ファイル名のみが指定されています。PATHから検索を試みます: ${filePath}`);
        try {
          const { stdout } = await execAsync(`where "${filePath}"`, { encoding: 'utf8' });
          const paths = stdout.trim().split('\n');
          if (paths.length > 0 && paths[0]) {
            resolvedPath = paths[0].trim();
            iconLogger.info(`PATHからファイルを解決: ${filePath} -> ${resolvedPath}`);
          }
        } catch (error) {
          iconLogger.error({ filePath, error }, 'PATHからファイルを解決できません');
        }
      }

      // 解決後も見つからない場合はエラー
      // シンボリックリンクの場合はlstatSyncを使用してリンク自体の存在をチェック
      try {
        fs.lstatSync(resolvedPath);
      } catch (error) {
        iconLogger.error({ filePath, error }, 'ファイルが見つかりません');
        return null;
      }
    }

    // .lnkファイルの場合は専用関数を使用
    if (PathUtils.isShortcutFile(resolvedPath)) {
      iconLogger.info(`ショートカットファイルを検出、専用処理を実行: ${resolvedPath}`);
      return await extractShortcutIcon(resolvedPath, iconsFolder);
    }

    // シンボリックリンクの場合は実際のパスを解決
    let actualFilePath = resolvedPath;
    try {
      const stats = fs.lstatSync(resolvedPath);
      if (stats.isSymbolicLink()) {
        // readlinkSyncを使用してリンクターゲットを取得
        // (realpathSyncはWindowsAppsフォルダで権限エラーになる)
        actualFilePath = fs.readlinkSync(resolvedPath);
        iconLogger.info(`シンボリックリンクを解決: ${resolvedPath} -> ${actualFilePath}`);
      }
    } catch (error) {
      iconLogger.warn({ resolvedPath, error }, 'シンボリックリンクの解決に失敗、元のパスを使用');
    }

    // キャッシュ用ファイル名を生成（元のfilePathを使用してキャッシュキーを生成）
    const iconName = path.basename(filePath, path.extname(filePath)) + '_icon.png';
    const iconPath = path.join(iconsFolder, iconName);

    // アイコンがすでにキャッシュされているか確認
    const cachedIcon = FileUtils.readCachedBinaryAsBase64(iconPath);
    if (cachedIcon) {
      return cachedIcon;
    }

    // アイコンを抽出（解決されたパスを使用）
    const iconBuffer = extractFileIcon(actualFilePath, 32);

    if (iconBuffer && iconBuffer.length > 0) {
      // キャッシュに保存
      FileUtils.writeBinaryFile(iconPath, iconBuffer);

      // base64データURLに変換
      return FileUtils.bufferToBase64DataUrl(iconBuffer);
    }

    iconLogger.warn(`アイコンが抽出できませんでした: ${filePath}`);
    return null;
  } catch (error) {
    iconLogger.error({ filePath, error }, 'アイコンの抽出に失敗しました');
    return null;
  }
}

export async function extractCustomUriIcon(
  uri: string,
  iconsFolder: string
): Promise<string | null> {
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
    const cachedIcon = FileUtils.readCachedBinaryAsBase64(iconPath);
    if (cachedIcon) {
      return cachedIcon;
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
      FileUtils.writeBinaryFile(iconPath, iconBuffer);

      // base64データURLに変換
      return FileUtils.bufferToBase64DataUrl(iconBuffer);
    }

    return null;
  } catch (error) {
    iconLogger.error({ uri, error }, 'カスタムURIアイコンの抽出に失敗しました');
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
export async function extractFileIconByExtension(
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
    const cachedIcon = FileUtils.readCachedBinaryAsBase64(iconPath);
    if (cachedIcon) {
      return cachedIcon;
    }

    // 拡張子に対応するダミーファイルを作成してアイコンを取得
    const tempFilePath = createTempFileForExtension(extensionName);

    try {
      // extract-file-iconを使用してアイコンを取得
      const iconBuffer = extractFileIcon(tempFilePath, 32);

      if (iconBuffer && iconBuffer.length > 0) {
        // キャッシュに保存
        FileUtils.writeBinaryFile(iconPath, iconBuffer);

        // base64データURLに変換
        return FileUtils.bufferToBase64DataUrl(iconBuffer);
      }
    } finally {
      // 一時ファイルを削除
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

    return null;
  } catch (error) {
    iconLogger.error({ filePath, error }, '拡張子ベースのアイコン抽出に失敗しました');
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
    iconLogger.error({ uri, error }, 'URIから拡張子の抽出に失敗');
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
  name?: string;
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

      // カスタムアイコンを最優先でチェック
      const itemWithCustomIcon = item as IconItem & { customIcon?: string };
      if (itemWithCustomIcon.customIcon) {
        const customIconPath = path.join(
          PathManager.getCustomIconsFolder(),
          itemWithCustomIcon.customIcon
        );
        if (fs.existsSync(customIconPath)) {
          iconPath = customIconPath;
        }
      }

      // カスタムアイコンがない場合は自動取得アイコンを確認
      if (!iconPath) {
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
          (PathUtils.isShortcutFile(item.originalPath) || PathUtils.isShortcutFile(item.path))
        ) {
          // ショートカットファイルの場合（展開済みアイテムまたは直接指定）
          // 元のショートカットパスを優先、なければ現在のパスを使用
          const shortcutPath = PathUtils.isShortcutFile(item.originalPath)
            ? item.originalPath!
            : item.path;

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
              const extensionIconPath = path.join(
                extensionsFolder,
                `ext_${extensionName}_icon.png`
              );
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
      } // カスタムアイコンがない場合のif文の終了

      if (iconPath) {
        const iconBuffer = fs.readFileSync(iconPath);
        iconCache[item.path] = FileUtils.bufferToBase64DataUrl(iconBuffer);
      }
    } catch (error) {
      iconLogger.error({ itemPath: item.path, error }, 'キャッシュされたアイコンの読み込みに失敗');
    }
  }

  return iconCache;
}

/**
 * ファビコン取得とアイコン抽出を統合して実行し、統合進捗を報告する
 */
async function fetchIconsCombined(
  urlItems: IconItem[],
  items: IconItem[],
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string
): Promise<{ favicons: Record<string, string | null>; icons: Record<string, string | null> }> {
  // フェーズタイプと各フェーズのアイテム数を設定
  const phaseTypes: ('favicon' | 'icon')[] = [];
  const phaseTotals: number[] = [];

  if (urlItems.length > 0) {
    phaseTypes.push('favicon');
    phaseTotals.push(urlItems.length);
  }

  if (items.length > 0) {
    phaseTypes.push('icon');
    phaseTotals.push(items.length);
  }

  const progress = new CombinedProgressManager(phaseTypes, phaseTotals, mainWindow);
  progress.start();

  const faviconResults: Record<string, string | null> = {};
  const iconResults: Record<string, string | null> = {};

  // フェーズ1: ファビコン取得
  if (urlItems.length > 0) {
    for (const urlItem of urlItems) {
      try {
        const favicon = await fetchFavicon(urlItem.path, faviconsFolder);
        faviconResults[urlItem.path] = favicon;

        // 進捗表示用の文字列を生成（アイテム名がある場合は「名前 + 改行 + URL」形式）
        const displayText = urlItem.name ? `${urlItem.name}\n${urlItem.path}` : urlItem.path;

        if (favicon) {
          progress.update(displayText);
        } else {
          progress.update(displayText, true, 'ファビコンが見つかりませんでした');
        }
      } catch (error) {
        iconLogger.error({ url: urlItem.path, error }, 'ファビコン取得エラー');
        faviconResults[urlItem.path] = null;
        const errorMsg = error instanceof Error ? error.message : 'ファビコン取得に失敗しました';
        const displayText = urlItem.name ? `${urlItem.name}\n${urlItem.path}` : urlItem.path;
        progress.update(displayText, true, errorMsg);
      }
    }

    progress.completePhase();
  }

  // フェーズ2: アイコン抽出
  if (items.length > 0) {
    for (const item of items) {
      try {
        let icon: string | null = null;

        if (item.type === 'app') {
          if (PathUtils.isShortcutFile(item.originalPath)) {
            icon = await extractIcon(item.originalPath!, iconsFolder);
          } else if (item.path.endsWith('.exe') || PathUtils.isShortcutFile(item.path)) {
            icon = await extractIcon(item.path, iconsFolder);
          } else if (
            item.path.endsWith('.bat') ||
            item.path.endsWith('.cmd') ||
            item.path.endsWith('.com')
          ) {
            // .bat/.cmd/.comファイルは拡張子ベースのアイコン取得を使用
            icon = await extractFileIconByExtension(item.path, extensionsFolder);
          }
        } else if (item.type === 'customUri') {
          icon = await extractCustomUriIcon(item.path, iconsFolder);
          if (!icon) {
            icon = await extractFileIconByExtension(item.path, extensionsFolder);
          }
        } else if (item.type === 'file') {
          icon = await extractFileIconByExtension(item.path, extensionsFolder);
        }

        iconResults[item.path] = icon;

        // 進捗表示用の文字列を生成（アイテム名がある場合は「名前 (パス)」形式）
        const displayText = item.name ? `${item.name}\n${item.path}` : item.path;

        if (icon) {
          progress.update(displayText);
        } else {
          progress.update(displayText, true, 'アイコンが見つかりませんでした');
        }
      } catch (error) {
        iconLogger.error({ itemPath: item.path, error }, 'アイコン抽出エラー');
        iconResults[item.path] = null;
        const errorMsg = error instanceof Error ? error.message : 'アイコン抽出に失敗しました';
        const displayText = item.name ? `${item.name}\n${item.path}` : item.path;
        progress.update(displayText, true, errorMsg);
      }
    }

    progress.completePhase();
  }

  progress.completeAll();

  return { favicons: faviconResults, icons: iconResults };
}

/**
 * カスタムアイコンファイルを選択するダイアログを表示
 * @returns 選択されたファイルパス、キャンセル時はnull
 */
async function selectCustomIconFile(): Promise<string | null> {
  try {
    const result = await dialog.showOpenDialog({
      title: 'カスタムアイコンを選択',
      filters: [
        { name: '画像ファイル', extensions: ['png', 'jpg', 'jpeg', 'ico', 'svg'] },
        { name: 'すべてのファイル', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  } catch (error) {
    iconLogger.error({ error }, 'カスタムアイコンファイル選択エラー');
    return null;
  }
}

/**
 * 画像ファイルをリサイズしてPNG形式で保存
 * @param inputPath 入力画像のパス
 * @param outputPath 出力PNGファイルのパス
 * @param maxSize 最大サイズ（デフォルト: 256px）
 */
async function resizeAndSaveImage(
  inputPath: string,
  outputPath: string,
  _maxSize: number = 256
): Promise<void> {
  try {
    // Sharp を使用した画像リサイズ処理
    // 現在はファイルをそのままコピーする簡易版として実装
    // 将来的にsharpライブラリを追加してリサイズ処理を実装予定
    await fs.promises.copyFile(inputPath, outputPath);
    iconLogger.info(`カスタムアイコンを保存: ${inputPath} -> ${outputPath}`);
  } catch (error) {
    iconLogger.error({ error }, '画像のリサイズ・保存エラー');
    throw error;
  }
}

/**
 * カスタムアイコンを保存
 * @param sourceFilePath 元の画像ファイルパス
 * @param itemIdentifier アイテムの識別子（パスまたはURL）
 * @returns 保存されたカスタムアイコンのファイル名
 */
async function saveCustomIcon(sourceFilePath: string, itemIdentifier: string): Promise<string> {
  try {
    // ファイル存在確認
    if (!fs.existsSync(sourceFilePath)) {
      throw new Error(`ソースファイルが見つかりません: ${sourceFilePath}`);
    }

    // ファイルサイズチェック（5MB制限）
    const stats = await fs.promises.stat(sourceFilePath);
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (stats.size > maxSize) {
      throw new Error('ファイルサイズが大きすぎます（最大5MB）');
    }

    // アイテム識別子からハッシュ値を生成してファイル名を決定
    const hash = crypto.createHash('md5').update(itemIdentifier).digest('hex').substring(0, 8);
    const customIconFileName = `${hash}.png`;
    const customIconPath = path.join(PathManager.getCustomIconsFolder(), customIconFileName);

    // 画像をリサイズして保存
    await resizeAndSaveImage(sourceFilePath, customIconPath);

    iconLogger.info(`カスタムアイコンを保存: ${itemIdentifier} -> ${customIconFileName}`);
    return customIconFileName;
  } catch (error) {
    iconLogger.error({ error }, 'カスタムアイコン保存エラー');
    throw error;
  }
}

/**
 * カスタムアイコンを削除
 * @param customIconFileName カスタムアイコンのファイル名
 */
async function deleteCustomIcon(customIconFileName: string): Promise<void> {
  try {
    const customIconPath = path.join(PathManager.getCustomIconsFolder(), customIconFileName);

    if (fs.existsSync(customIconPath)) {
      await fs.promises.unlink(customIconPath);
      iconLogger.info(`カスタムアイコンを削除: ${customIconFileName}`);
    }
  } catch (error) {
    iconLogger.error({ error }, 'カスタムアイコン削除エラー');
    throw error;
  }
}

/**
 * カスタムアイコンを取得
 * @param customIconFileName カスタムアイコンのファイル名
 * @returns base64エンコードされたアイコンデータURL、見つからない場合はnull
 */
async function getCustomIcon(customIconFileName: string): Promise<string | null> {
  try {
    const customIconPath = path.join(PathManager.getCustomIconsFolder(), customIconFileName);
    return FileUtils.readCachedBinaryAsBase64(customIconPath);
  } catch (error) {
    iconLogger.error({ error }, 'カスタムアイコン取得エラー');
    return null;
  }
}

/**
 * アイテムタイプに応じて適切なアイコンを取得（IconServiceを使用）
 * レンダラープロセスから呼び出すための統合API
 *
 * @param filePath ファイルパスまたはURL
 * @param itemType アイテムタイプ
 * @returns base64エンコードされたアイコンデータURL、取得失敗時はnull
 */
async function getIconForItem(
  filePath: string,
  itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri'
): Promise<string | null> {
  try {
    const iconsFolder = PathManager.getIconsFolder();
    const extensionsFolder = PathManager.getExtensionsFolder();

    const icon = await IconService.getIconForItem(
      filePath,
      itemType,
      iconsFolder,
      extensionsFolder
    );
    return icon || null;
  } catch (error) {
    iconLogger.error({ error, filePath, itemType }, 'アイコン取得エラー');
    return null;
  }
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

  // 統合進捗API
  ipcMain.handle(
    'fetch-icons-combined',
    async (_event, urlItems: IconItem[], items: IconItem[]) => {
      return await fetchIconsCombined(
        urlItems,
        items,
        faviconsFolder,
        iconsFolder,
        extensionsFolder
      );
    }
  );

  // カスタムアイコン関連のハンドラー
  ipcMain.handle('select-custom-icon-file', async () => {
    return await selectCustomIconFile();
  });

  ipcMain.handle(
    'save-custom-icon',
    async (_event, sourceFilePath: string, itemIdentifier: string) => {
      return await saveCustomIcon(sourceFilePath, itemIdentifier);
    }
  );

  ipcMain.handle('delete-custom-icon', async (_event, customIconFileName: string) => {
    return await deleteCustomIcon(customIconFileName);
  });

  ipcMain.handle('get-custom-icon', async (_event, customIconFileName: string) => {
    return await getCustomIcon(customIconFileName);
  });

  // IconService統合API
  ipcMain.handle(
    'get-icon-for-item',
    async (_event, filePath: string, itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri') => {
      return await getIconForItem(filePath, itemType);
    }
  );
}
