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
import { IPC_CHANNELS } from '@common/ipcChannels';

import { CombinedProgressManager } from '../utils/progressManager';
import { FaviconService } from '../services/faviconService';
import { IconFetchErrorService } from '../services/iconFetchErrorService';
import PathManager from '../config/pathManager.js';

// FaviconServiceのインスタンスを保持
let faviconService: FaviconService;

// メインウィンドウへの参照を保持
let mainWindow: BrowserWindow | null = null;

const execAsync = promisify(exec);

/** 環境変数を展開する（%VAR%形式） */
function expandEnvironmentVariables(envPath: string): string {
  return envPath.replace(/%([^%]+)%/g, (original, envVar) => process.env[envVar] || original);
}

/** 指定されたURLのファビコンを取得する（FaviconServiceへの委譲） */
async function fetchFavicon(url: string, faviconsFolder: string): Promise<string | null> {
  if (!faviconService) {
    faviconService = new FaviconService(faviconsFolder);
  }
  return faviconService.fetchFavicon(url);
}

/** ショートカットファイル(.lnk)からアイコンを抽出してキャッシュに保存する */
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

/** 実行ファイルからアイコンを抽出してキャッシュに保存する */
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

/** ファイル拡張子に基づいてアイコンを抽出し、キャッシュに保存する */
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
  customIcon?: string;
}

/** 候補パスの中から最初に存在するファイルのパスを返す */
function findExistingFile(...paths: string[]): string | null {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** 拡張子アイコンのキャッシュパスを取得 */
function getExtensionIconPath(extensionsFolder: string, ext: string): string {
  return path.join(extensionsFolder, `ext_${ext.replace('.', '')}_icon.png`);
}

/** 複数のアイテムのキャッシュされたアイコンを一括で読み込む */
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
      if (item.customIcon) {
        const customIconPath = path.join(PathManager.getCustomIconsFolder(), item.customIcon);
        iconPath = findExistingFile(customIconPath);
      }

      // カスタムアイコンがない場合は自動取得アイコンを確認
      if (!iconPath) {
        iconPath = findCachedIconPath(item, faviconsFolder, iconsFolder, extensionsFolder);
      }

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

/** アイテムタイプに応じたキャッシュアイコンのパスを検索 */
function findCachedIconPath(
  item: IconItem,
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string
): string | null {
  if (item.type === 'url' && item.path?.includes('://')) {
    const domain = new URL(item.path).hostname;
    return findExistingFile(
      path.join(faviconsFolder, `${domain}_favicon_64.png`),
      path.join(faviconsFolder, `${domain}_favicon_32.png`)
    );
  }

  if (item.type === 'app') {
    // ショートカットファイルの場合
    if (PathUtils.isShortcutFile(item.originalPath) || PathUtils.isShortcutFile(item.path)) {
      const shortcutPath = PathUtils.isShortcutFile(item.originalPath)
        ? item.originalPath!
        : item.path;
      const shortcutName = path.basename(shortcutPath, '.lnk');
      return findExistingFile(
        path.join(iconsFolder, `${shortcutName}_lnk_icon.png`),
        path.join(iconsFolder, `${shortcutName}_icon.png`)
      );
    }

    // 通常の実行ファイル
    if (item.path) {
      const lowerPath = item.path.toLowerCase();
      if (lowerPath.endsWith('.exe')) {
        const iconName = path.basename(item.path, path.extname(item.path)) + '_icon.png';
        return findExistingFile(path.join(iconsFolder, iconName));
      }
      if (lowerPath.endsWith('.bat') || lowerPath.endsWith('.cmd') || lowerPath.endsWith('.com')) {
        const extensionName = path.extname(item.path).slice(1).toLowerCase();
        return findExistingFile(getExtensionIconPath(extensionsFolder, extensionName));
      }
    }
  }

  if (item.type === 'customUri' && item.path) {
    // スキーマベースのアイコンを優先
    const schemeMatch = item.path.match(/^([^:]+):/);
    if (schemeMatch) {
      const uriIconPath = path.join(iconsFolder, `uri_${schemeMatch[1]}_icon.png`);
      if (fs.existsSync(uriIconPath)) return uriIconPath;
    }
    // 拡張子ベースにフォールバック
    const fileExtension = extractExtensionFromUri(item.path);
    if (fileExtension) {
      return findExistingFile(getExtensionIconPath(extensionsFolder, fileExtension));
    }
  }

  if (item.type === 'file' && item.path) {
    const fileExtension = path.extname(item.path).toLowerCase();
    if (fileExtension) {
      return findExistingFile(getExtensionIconPath(extensionsFolder, fileExtension));
    }
  }

  return null;
}

/** 進捗表示用テキストを生成 */
function getDisplayText(item: IconItem): string {
  return item.name ? `${item.name}\n${item.path}` : item.path;
}

/** エラー記録のないアイテムのみをフィルタリング */
async function filterItemsWithoutErrors(
  items: IconItem[],
  errorService: IconFetchErrorService,
  errorType: 'favicon' | 'icon'
): Promise<IconItem[]> {
  const result: IconItem[] = [];
  for (const item of items) {
    if (await errorService.hasError(item.path, errorType)) {
      iconLogger.info({ path: item.path }, `Skipping ${errorType} fetch due to previous error`);
    } else {
      result.push(item);
    }
  }
  return result;
}

/** アイテムからアイコンを抽出 */
async function extractIconForItem(
  item: IconItem,
  iconsFolder: string,
  extensionsFolder: string
): Promise<string | null> {
  if (item.type === 'app') {
    if (PathUtils.isShortcutFile(item.originalPath)) {
      return extractIcon(item.originalPath!, iconsFolder);
    }
    if (item.path.endsWith('.exe') || PathUtils.isShortcutFile(item.path)) {
      return extractIcon(item.path, iconsFolder);
    }
    if (item.path.endsWith('.bat') || item.path.endsWith('.cmd') || item.path.endsWith('.com')) {
      return extractFileIconByExtension(item.path, extensionsFolder);
    }
  }

  if (item.type === 'customUri') {
    const icon = await extractCustomUriIcon(item.path, iconsFolder);
    return icon || extractFileIconByExtension(item.path, extensionsFolder);
  }

  if (item.type === 'file') {
    return extractFileIconByExtension(item.path, extensionsFolder);
  }

  return null;
}

/** ファビコン取得とアイコン抽出を統合して実行し、統合進捗を報告する */
async function fetchIconsCombined(
  urlItems: IconItem[],
  items: IconItem[],
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string,
  forceRefresh: boolean = false
): Promise<{ favicons: Record<string, string | null>; icons: Record<string, string | null> }> {
  const errorService = await IconFetchErrorService.getInstance();

  if (forceRefresh) {
    await errorService.clearAllErrors();
  }

  // エラー記録のないアイテムをフィルタリング
  const filteredUrlItems = forceRefresh
    ? urlItems
    : await filterItemsWithoutErrors(urlItems, errorService, 'favicon');
  const filteredItems = forceRefresh
    ? items
    : await filterItemsWithoutErrors(items, errorService, 'icon');

  // フェーズ設定
  const phaseTypes: ('favicon' | 'icon')[] = [];
  const phaseTotals: number[] = [];

  if (filteredUrlItems.length > 0) {
    phaseTypes.push('favicon');
    phaseTotals.push(filteredUrlItems.length);
  }
  if (filteredItems.length > 0) {
    phaseTypes.push('icon');
    phaseTotals.push(filteredItems.length);
  }

  const progress = new CombinedProgressManager(phaseTypes, phaseTotals, mainWindow);
  progress.start();

  // 各フェーズ共通の処理ループ
  async function processPhase(
    items: IconItem[],
    errorType: 'favicon' | 'icon',
    fetchFn: (item: IconItem) => Promise<string | null>,
    notFoundMsg: string,
    fallbackMsg: string
  ): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};

    for (const item of items) {
      const displayText = getDisplayText(item);
      try {
        const result = await fetchFn(item);
        results[item.path] = result;

        if (result) {
          progress.update(displayText);
        } else {
          await errorService.recordError(item.path, errorType, notFoundMsg);
          progress.update(displayText, true, notFoundMsg);
        }
      } catch (error) {
        iconLogger.error({ path: item.path, error }, `${errorType} fetch error`);
        results[item.path] = null;
        const errorMsg = error instanceof Error ? error.message : fallbackMsg;
        await errorService.recordError(item.path, errorType, errorMsg);
        progress.update(displayText, true, errorMsg);
      }
    }

    if (items.length > 0) progress.completePhase();
    return results;
  }

  const faviconResults = await processPhase(
    filteredUrlItems,
    'favicon',
    (item) => fetchFavicon(item.path, faviconsFolder),
    'ファビコンが見つかりませんでした',
    'ファビコン取得に失敗しました'
  );

  const iconResults = await processPhase(
    filteredItems,
    'icon',
    (item) => extractIconForItem(item, iconsFolder, extensionsFolder),
    'アイコンが見つかりませんでした',
    'アイコン抽出に失敗しました'
  );

  progress.completeAll();
  return { favicons: faviconResults, icons: iconResults };
}

/** カスタムアイコンファイルを選択するダイアログを表示 */
async function selectCustomIconFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'カスタムアイコンを選択',
    filters: [
      { name: '画像ファイル', extensions: ['png', 'jpg', 'jpeg', 'ico', 'svg'] },
      { name: 'すべてのファイル', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  return result.canceled ? null : (result.filePaths[0] ?? null);
}

/** 画像ファイルをコピーして保存（将来的にリサイズ処理を追加予定） */
async function copyImageFile(inputPath: string, outputPath: string): Promise<void> {
  await fs.promises.copyFile(inputPath, outputPath);
  iconLogger.info(`カスタムアイコンを保存: ${inputPath} -> ${outputPath}`);
}

/** カスタムアイコンを保存し、ファイル名を返す */
async function saveCustomIcon(sourceFilePath: string, itemIdentifier: string): Promise<string> {
  if (!fs.existsSync(sourceFilePath)) {
    throw new Error(`ソースファイルが見つかりません: ${sourceFilePath}`);
  }

  const stats = await fs.promises.stat(sourceFilePath);
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error('ファイルサイズが大きすぎます（最大5MB）');
  }

  const hash = crypto.createHash('md5').update(itemIdentifier).digest('hex').substring(0, 8);
  const customIconFileName = `${hash}.png`;
  const customIconPath = path.join(PathManager.getCustomIconsFolder(), customIconFileName);

  await copyImageFile(sourceFilePath, customIconPath);
  iconLogger.info(`カスタムアイコンを保存: ${itemIdentifier} -> ${customIconFileName}`);
  return customIconFileName;
}

/** カスタムアイコンを削除 */
async function deleteCustomIcon(customIconFileName: string): Promise<void> {
  const customIconPath = path.join(PathManager.getCustomIconsFolder(), customIconFileName);

  if (fs.existsSync(customIconPath)) {
    await fs.promises.unlink(customIconPath);
    iconLogger.info(`カスタムアイコンを削除: ${customIconFileName}`);
  }
}

/** カスタムアイコンをbase64で取得 */
function getCustomIcon(customIconFileName: string): string | null {
  const customIconPath = path.join(PathManager.getCustomIconsFolder(), customIconFileName);
  return FileUtils.readCachedBinaryAsBase64(customIconPath);
}

/** アイテムタイプに応じて適切なアイコンを取得（統合API） */
async function getIconForItem(
  filePath: string,
  itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri'
): Promise<string | null> {
  const iconsFolder = PathManager.getAppsFolder();
  const extensionsFolder = PathManager.getExtensionsFolder();

  switch (itemType) {
    case 'app':
      return extractIcon(filePath, iconsFolder);
    case 'file':
      return extractFileIconByExtension(filePath, extensionsFolder);
    case 'customUri':
      return extractCustomUriIcon(filePath, iconsFolder);
    default:
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

  ipcMain.handle(IPC_CHANNELS.FETCH_FAVICON, (_event, url: string) =>
    fetchFavicon(url, faviconsFolder)
  );

  ipcMain.handle(IPC_CHANNELS.EXTRACT_ICON, (_event, filePath: string) =>
    extractIcon(filePath, iconsFolder)
  );

  ipcMain.handle(IPC_CHANNELS.EXTRACT_FILE_ICON_BY_EXTENSION, (_event, filePath: string) =>
    extractFileIconByExtension(filePath, extensionsFolder)
  );

  ipcMain.handle(IPC_CHANNELS.EXTRACT_CUSTOM_URI_ICON, (_event, uri: string) =>
    extractCustomUriIcon(uri, iconsFolder)
  );

  ipcMain.handle(IPC_CHANNELS.LOAD_CACHED_ICONS, (_event, items: IconItem[]) =>
    loadCachedIcons(items, faviconsFolder, iconsFolder, extensionsFolder)
  );

  // 統合進捗API
  ipcMain.handle(
    IPC_CHANNELS.FETCH_ICONS_COMBINED,
    (_event, urlItems: IconItem[], items: IconItem[], forceRefresh: boolean = false) =>
      fetchIconsCombined(
        urlItems,
        items,
        faviconsFolder,
        iconsFolder,
        extensionsFolder,
        forceRefresh
      )
  );

  // アイコン取得エラー記録をクリア
  ipcMain.handle(IPC_CHANNELS.CLEAR_ICON_FETCH_ERRORS, async () => {
    await (await IconFetchErrorService.getInstance()).clearAllErrors();
    return { success: true };
  });

  // アイコン取得エラー記録を取得
  ipcMain.handle(IPC_CHANNELS.GET_ICON_FETCH_ERRORS, async () =>
    (await IconFetchErrorService.getInstance()).getAllErrors()
  );

  // カスタムアイコン関連のハンドラー
  ipcMain.handle(IPC_CHANNELS.SELECT_CUSTOM_ICON_FILE, selectCustomIconFile);

  ipcMain.handle(
    IPC_CHANNELS.SAVE_CUSTOM_ICON,
    (_event, sourceFilePath: string, itemIdentifier: string) =>
      saveCustomIcon(sourceFilePath, itemIdentifier)
  );

  ipcMain.handle(IPC_CHANNELS.DELETE_CUSTOM_ICON, (_event, customIconFileName: string) =>
    deleteCustomIcon(customIconFileName)
  );

  ipcMain.handle(IPC_CHANNELS.GET_CUSTOM_ICON, (_event, customIconFileName: string) =>
    getCustomIcon(customIconFileName)
  );

  // IconService統合API
  ipcMain.handle(
    IPC_CHANNELS.GET_ICON_FOR_ITEM,
    (_event, filePath: string, itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri') =>
      getIconForItem(filePath, itemType)
  );
}
