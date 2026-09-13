import * as path from 'path';
import * as fs from 'fs';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as crypto from 'crypto';

import { ipcMain, dialog, shell, type BrowserWindow } from 'electron';
import { iconLogger } from '@common/logger';
import type { LauncherItem } from '@common/types';
import { FileUtils } from '@common/utils/fileUtils';
import { PathUtils } from '@common/utils/pathUtils';
import extractFileIcon from 'extract-file-icon';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { isIconFetchTarget } from '@common/constants';

import { CombinedProgressManager } from '../utils/progressManager';
import { FaviconService } from '../services/faviconService';
import { IconFetchErrorService } from '../services/iconFetchErrorService';
import PathManager from '../config/pathManager.js';
import { getMainWindow } from '../windowManager.js';
import { runWithConcurrency } from '../utils/concurrency.js';
import {
  classifyIconTarget,
  extractExtensionFromUri,
  extractPackageFamilyName,
  getCachedIconCandidates,
  resolveShortcutPath,
  type IconFolders,
  type IconTargetItem,
} from '../utils/iconCacheKeys.js';

// 同時実行数の上限（ファビコンはネットワークI/O、アイコン抽出は子プロセス起動を伴う）
const FAVICON_CONCURRENCY = 5;
const ICON_EXTRACT_CONCURRENCY = 4;
const CACHED_ICON_READ_CONCURRENCY = 16;

// FaviconServiceのインスタンスを保持
let faviconService: FaviconService;

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

/** 環境変数を展開する（%VAR%形式） */
function expandEnvironmentVariables(envPath: string): string {
  return envPath.replace(/%([^%]+)%/g, (original, envVar) => process.env[envVar] || original);
}

/** 指定されたURLのファビコンを取得する（FaviconServiceへの委譲） */
async function fetchFavicon(
  url: string,
  faviconsFolder: string,
  forceRefresh = false
): Promise<string | null> {
  if (!faviconService) {
    faviconService = new FaviconService(faviconsFolder);
  }
  return faviconService.fetchFavicon(url, forceRefresh);
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
          if (expandedIconPath.toLowerCase().endsWith('.ico')) {
            const result = cacheAndConvertIcon(extractFileIcon(expandedIconPath, 32), lnkIconPath);
            if (result) {
              iconLogger.info(
                `カスタムアイコンファイルからアイコンを抽出成功: ${expandedIconPath}`
              );
              return result;
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
    const shortcutIcon = cacheAndConvertIcon(extractFileIcon(lnkPath, 32), lnkIconPath);
    if (shortcutIcon) {
      iconLogger.info(`ショートカットファイルからアイコンを抽出成功: ${lnkPath}`);
      return shortcutIcon;
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
    // カスタムURIスキーム（obsidian:// や ms-todo: 等）はファイルパスではないため専用経路に委譲する。
    // レイアウトアイテムのexecutablePathには起動用のURIが入り得るが、ここでファイルとして
    // 解決を試みるとwhere実行とlstatが毎回失敗し、読み込みのたびにログノイズが発生する。
    // フォールバック順はfetchIconForItem（customUriアイテム）と揃える
    if (PathUtils.isCustomUriScheme(filePath)) {
      const uriIcon = await extractCustomUriIcon(filePath, iconsFolder);
      return (
        uriIcon ?? (await extractFileIconByExtension(filePath, PathManager.getExtensionsFolder()))
      );
    }

    let resolvedPath = filePath;

    // ファイルが存在するか確認、存在しない場合はパスを解決
    if (!FileUtils.exists(filePath)) {
      // ファイルが見つからない場合、PATHから検索を試みる
      if (process.platform === 'win32' && !filePath.includes('\\') && !filePath.includes('/')) {
        iconLogger.info(`ファイル名のみが指定されています。PATHから検索を試みます: ${filePath}`);
        try {
          // shell経由のexecは"や&入りファイル名でコマンドインジェクションが起き得るため引数配列で渡す
          const { stdout } = await execFileAsync('where', [filePath], { encoding: 'utf8' });
          const paths = stdout.trim().split('\n');
          if (paths.length > 0 && paths[0]) {
            resolvedPath = paths[0].trim();
            iconLogger.info(`PATHからファイルを解決: ${filePath} -> ${resolvedPath}`);
          }
        } catch (error) {
          // PATHに存在しないのはデータ側の状態であり内部エラーではない
          iconLogger.warn({ filePath, error }, 'PATHからファイルを解決できません');
        }
      }

      // 解決後も見つからない場合はアイコンなしとして扱う
      // （アンインストール済みexe等、データ側の状態なのでwarnに留める）
      // シンボリックリンクの場合はlstatSyncを使用してリンク自体の存在をチェック
      try {
        fs.lstatSync(resolvedPath);
      } catch (error) {
        iconLogger.warn({ filePath, error }, 'ファイルが見つかりません');
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

    const result = cacheAndConvertIcon(extractFileIcon(actualFilePath, 32), iconPath);
    if (!result) {
      iconLogger.warn(`アイコンが抽出できませんでした: ${filePath}`);
    }
    return result;
  } catch (error) {
    iconLogger.error({ filePath, error }, 'アイコンの抽出に失敗しました');
    return null;
  }
}

/** アイコンバッファをキャッシュに保存し、base64データURLとして返す */
function cacheAndConvertIcon(iconBuffer: Buffer, cachePath: string): string | null {
  if (!iconBuffer || iconBuffer.length === 0) return null;
  FileUtils.writeBinaryFile(cachePath, iconBuffer);
  return FileUtils.bufferToBase64DataUrl(iconBuffer);
}

export async function extractCustomUriIcon(
  uri: string,
  iconsFolder: string
): Promise<string | null> {
  try {
    const schemeMatch = uri.match(/^([^:]+):/);
    if (!schemeMatch) return null;

    const scheme = schemeMatch[1];
    const iconPath = path.join(iconsFolder, `uri_${scheme}_icon.png`);

    const cachedIcon = FileUtils.readCachedBinaryAsBase64(iconPath);
    if (cachedIcon) return cachedIcon;

    const handlerPath = await getUriSchemeHandler(scheme);
    if (handlerPath) {
      return cacheAndConvertIcon(extractFileIcon(handlerPath, 32), iconPath);
    }

    // レジストリから実行ファイルを解決できないスキームはUWPアプリの可能性がある
    // （UWPはPackagedCOM方式のため shell\open\command が存在しない）
    return await extractUwpIconByUriScheme(scheme, iconPath);
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

    const tempFilePath = createTempFileForExtension(extensionName);

    try {
      return cacheAndConvertIcon(extractFileIcon(tempFilePath, 32), iconPath);
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
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

    // URIスキーム名として妥当な文字列のみ許可する（RFC 3986）。
    // インポート等で不正な文字列が混入した場合にレジストリ照会へ渡さない
    if (!/^[A-Za-z][A-Za-z0-9+.-]*$/.test(cleanScheme)) {
      iconLogger.warn({ scheme }, '不正なURIスキーム名のためレジストリ照会をスキップします');
      return null;
    }

    // レジストリからスキーマハンドラーを取得
    // （shell経由のexecは特殊文字でコマンドインジェクションが起き得るため引数配列で渡す）
    await execFileAsync('reg', ['query', `HKEY_CLASSES_ROOT\\${cleanScheme}`, '/ve'], {
      encoding: 'utf8',
    });

    // レジストリから実行ファイルパスを取得
    const { stdout: commandStdout } = await execFileAsync(
      'reg',
      ['query', `HKEY_CLASSES_ROOT\\${cleanScheme}\\shell\\open\\command`, '/ve'],
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

function createTempFileForExtension(extension: string): string {
  const tempDir = os.tmpdir();
  const tempFileName = `temp_icon_extract_${crypto.randomUUID()}.${extension}`;
  const tempFilePath = path.join(tempDir, tempFileName);

  // 空のファイルを作成
  fs.writeFileSync(tempFilePath, '');

  return tempFilePath;
}

/** アイコン取得・読み出しの対象アイテム（キー決定に必要な情報＋表示用の付随情報） */
interface IconItem extends IconTargetItem {
  name?: string;
  customIcon?: string;
}

/** PathManagerからアイコンキャッシュのフォルダ群を取得する */
function getIconFolders(): IconFolders {
  return {
    favicons: PathManager.getFaviconsFolder(),
    icons: PathManager.getAppsFolder(),
    extensions: PathManager.getExtensionsFolder(),
  };
}

/** 候補パスを順に読み込み、最初に読み込めたファイルをbase64データURLとして返す */
async function readFirstExistingFileAsBase64(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    try {
      const buffer = await fs.promises.readFile(p);
      return FileUtils.bufferToBase64DataUrl(buffer);
    } catch {
      // 存在しない候補はスキップして次を試す
    }
  }
  return null;
}

/** 複数のアイテムのキャッシュされたアイコンを一括で読み込む */
async function loadCachedIcons(
  items: IconItem[],
  folders: IconFolders
): Promise<Record<string, string>> {
  const iconCache: Record<string, string> = {};

  const tasks = items.map((item) => async () => {
    try {
      // カスタムアイコンを最優先、なければ自動取得アイコンの候補を順に試す
      const candidates: string[] = [];
      if (item.customIcon) {
        candidates.push(path.join(PathManager.getCustomIconsFolder(), item.customIcon));
      }
      candidates.push(...getCachedIconCandidates(item, folders));

      const icon = await readFirstExistingFileAsBase64(candidates);
      if (icon) {
        iconCache[item.path] = icon;
      }
    } catch (error) {
      iconLogger.error({ itemPath: item.path, error }, 'キャッシュされたアイコンの読み込みに失敗');
    }
  });

  await runWithConcurrency(tasks, CACHED_ICON_READ_CONCURRENCY);
  return iconCache;
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
  const errorKeys = new Set(
    (await errorService.getAllErrors())
      .filter((error) => error.type === errorType)
      .map((error) => error.key)
  );

  return items.filter((item) => {
    if (errorKeys.has(item.path)) {
      iconLogger.info({ path: item.path }, `Skipping ${errorType} fetch due to previous error`);
      return false;
    }
    return true;
  });
}

/** パッケージ情報のメモリキャッシュ */
interface AppxPackageInfo {
  installLocation: string;
  logoPaths: string[];
}
/** パッケージ名で引く情報と、URIスキーム名からパッケージ名を引く逆引きの組 */
interface AppxCache {
  byPackageName: Map<string, AppxPackageInfo>;
  packageNameByProtocol: Map<string, string>;
}
let appxPackageCache: AppxCache | null = null;
let appxCachePromise: Promise<AppxCache> | null = null;
/** 取得失敗した時刻。一時的な失敗から回復できるよう一定時間後に再試行する */
let appxCacheFailedAt: number | null = null;
const APPX_CACHE_RETRY_INTERVAL_MS = 5 * 60 * 1000;

/**
 * 全AppxPackage情報を1回のPowerShellで一括取得してメモリにキャッシュする。
 * 2回目以降はキャッシュを返す。複数同時呼び出しでも1回だけ実行される。
 *
 * マニフェストの windows.protocol 拡張も併せて取得し、UWPアプリが登録した
 * URIスキーム（ms-todo: 等）からパッケージを逆引きできるようにする
 */
async function getAppxPackageCache(): Promise<AppxCache> {
  if (appxPackageCache) return appxPackageCache;
  if (appxCachePromise) return appxCachePromise;

  // 直近に失敗している場合は、毎回PowerShellを起動しないよう一定時間は空の結果を返す
  if (appxCacheFailedAt !== null && Date.now() - appxCacheFailedAt < APPX_CACHE_RETRY_INTERVAL_MS) {
    return { byPackageName: new Map(), packageNameByProtocol: new Map() };
  }

  appxCachePromise = (async () => {
    const cache: AppxCache = { byPackageName: new Map(), packageNameByProtocol: new Map() };
    try {
      const output = await execAsync(
        `powershell.exe -NoProfile -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-AppxPackage | ForEach-Object { $m = Get-AppxPackageManifest -Package $_ -ErrorAction SilentlyContinue; if ($m) { $a = $m.Package.Applications.Application; if ($a -is [System.Array]) { $a = $a[0] }; if ($a) { $v = $a.VisualElements; $p = @(); foreach ($e in @($a.Extensions.Extension)) { if ($e.Category -eq 'windows.protocol' -and $e.Protocol.Name) { $p += $e.Protocol.Name } }; Write-Output (($_.Name + '|' + $_.InstallLocation + '|' + $v.Square44x44Logo + '|' + $v.Square150x150Logo + '|' + ($p -join ','))) } } }"`,
        { encoding: 'utf8', timeout: 30000 }
      );

      for (const line of output.stdout.trim().split(/\r?\n/)) {
        const [name, installLocation, logo44, logo150, protocols] = line
          .split('|')
          .map((s) => s.trim());
        if (!name || !installLocation) continue;

        cache.byPackageName.set(name, {
          installLocation,
          logoPaths: [logo44, logo150].filter(Boolean),
        });

        for (const protocol of (protocols ?? '').split(',')) {
          const scheme = protocol.trim().toLowerCase();
          // 同一スキームを複数パッケージが宣言した場合は先勝ち
          if (scheme && !cache.packageNameByProtocol.has(scheme)) {
            cache.packageNameByProtocol.set(scheme, name);
          }
        }
      }
      iconLogger.info(
        { count: cache.byPackageName.size, protocolCount: cache.packageNameByProtocol.size },
        'AppxPackage情報を一括取得完了'
      );
      appxCacheFailedAt = null;
      appxPackageCache = cache;
    } catch (error) {
      // 結果をキャッシュせず、一定時間後の呼び出しで再試行できるようにする
      appxCacheFailedAt = Date.now();
      iconLogger.warn({ error }, 'AppxPackage情報の一括取得に失敗');
    }
    appxCachePromise = null;
    return cache;
  })();

  return appxCachePromise;
}

/** UWPアプリのパッケージ名からマニフェスト経由でアイコンを取得し、指定パスにキャッシュする */
async function extractUwpIconByPackageName(
  packageName: string,
  cachePath: string
): Promise<string | null> {
  const pkgInfo = (await getAppxPackageCache()).byPackageName.get(packageName);
  if (!pkgInfo || !fs.existsSync(pkgInfo.installLocation)) return null;

  const iconFilePath = findIconFromManifestLogo(pkgInfo.installLocation, pkgInfo.logoPaths);
  if (!iconFilePath) return null;

  return cacheAndConvertIcon(fs.readFileSync(iconFilePath), cachePath);
}

/** UWPアプリのパッケージ名からマニフェスト経由でアイコンを取得する */
async function extractUwpIcon(appPath: string, iconsFolder: string): Promise<string | null> {
  const packageFamilyName = extractPackageFamilyName(appPath);
  if (!packageFamilyName) return null;

  const cachePath = path.join(
    iconsFolder,
    `uwp_${packageFamilyName.replace(/[^a-zA-Z0-9._-]/g, '_')}_icon.png`
  );
  const cachedIcon = FileUtils.readCachedBinaryAsBase64(cachePath);
  if (cachedIcon) return cachedIcon;

  try {
    return await extractUwpIconByPackageName(packageFamilyName.split('_')[0], cachePath);
  } catch (error) {
    iconLogger.warn({ appPath, error }, 'UWPアイコンの取得に失敗');
    return null;
  }
}

/**
 * URIスキームを登録しているUWPアプリのアイコンを取得する
 *
 * UWPアプリはPackagedCOM方式で起動されるためレジストリの shell\open\command が無く、
 * getUriSchemeHandler() では実行ファイルを解決できない。
 * パッケージマニフェストの windows.protocol 宣言から逆引きする
 */
async function extractUwpIconByUriScheme(
  scheme: string,
  cachePath: string
): Promise<string | null> {
  try {
    const { packageNameByProtocol } = await getAppxPackageCache();
    const packageName = packageNameByProtocol.get(scheme.toLowerCase());
    if (!packageName) return null;

    iconLogger.info({ scheme, packageName }, 'URIスキームをUWPパッケージとして解決');
    return await extractUwpIconByPackageName(packageName, cachePath);
  } catch (error) {
    iconLogger.warn({ scheme, error }, 'URIスキームからのUWPアイコン取得に失敗');
    return null;
  }
}

/**
 * マニフェストのロゴパスから実際のアイコンファイルを探す。
 * マニフェストのパスは "Assets\Logo.png" のような相対パスだが、
 * 実ファイルは "Logo.scale-100.png" のようなスケール付きファイル名になっている。
 */
function findIconFromManifestLogo(installLocation: string, logoPaths: string[]): string | null {
  for (const logoRelPath of logoPaths) {
    const fullPath = path.join(installLocation, logoRelPath);
    if (fs.existsSync(fullPath)) return fullPath;

    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) continue;

    const baseName = path.basename(logoRelPath, path.extname(logoRelPath));
    const ext = path.extname(logoRelPath);
    const files = fs.readdirSync(dir);

    // contrast/altform を除外した候補を優先し、なければ除外なしで再試行
    const match =
      findSmallestScaleIcon(files, baseName, ext, true) ??
      findSmallestScaleIcon(files, baseName, ext, false);
    if (match) return path.join(dir, match);
  }
  return null;
}

/** scaleが最小のアイコンファイル名を返す。見つからなければnull */
function findSmallestScaleIcon(
  files: string[],
  baseName: string,
  ext: string,
  excludeVariants: boolean
): string | null {
  const parseScale = (f: string): number => parseInt(f.match(/scale-(\d+)/)?.[1] ?? '999');

  const candidates = files.filter(
    (f) =>
      f.startsWith(baseName) &&
      f.endsWith(ext) &&
      (!excludeVariants || (!f.includes('contrast-') && !f.includes('_altform-')))
  );

  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => parseScale(a) - parseScale(b))[0];
}

/**
 * アイテムタイプに応じてアイコンを取得し、キャッシュへ保存する（取得系の唯一の入口）
 *
 * どの取得方法を使うかは classifyIconTarget が決める。読み出し側の
 * getCachedIconCandidates も同じ判定を使っており、ここで独自に分岐すると
 * 保存先と読み出し先が食い違って「取得できているのに表示されない」状態になる。
 *
 * @param forceRefresh キャッシュを無視して取り直す（ファビコンのみ対象）
 */
async function fetchIconForItem(
  item: IconItem,
  folders: IconFolders,
  forceRefresh = false
): Promise<string | null> {
  switch (classifyIconTarget(item)) {
    case 'favicon':
      return fetchFavicon(item.path, folders.favicons, forceRefresh);

    case 'uwp':
      return extractUwpIcon(item.path, folders.icons);

    case 'shortcut':
      return extractIcon(resolveShortcutPath(item), folders.icons);

    case 'script':
      return extractFileIconByExtension(item.path, folders.extensions);

    case 'executable':
      return extractIcon(item.path, folders.icons);

    case 'customUri': {
      const icon = await extractCustomUriIcon(item.path, folders.icons);
      return icon || extractFileIconByExtension(item.path, folders.extensions);
    }

    case 'fileExtension':
      return extractFileIconByExtension(item.path, folders.extensions);

    case 'none':
      // folder / group / windowOperation / clipboard / layout はデフォルトアイコンを使用
      return null;
  }
}

/**
 * ファビコン取得とアイコン抽出を統合して実行する
 *
 * @param progressWindow 進捗の通知先。nullを渡すと進捗を送らない（バックグラウンド補完用）
 */
async function fetchIconsCombined(
  urlItems: IconItem[],
  items: IconItem[],
  folders: IconFolders,
  forceRefresh: boolean = false,
  progressWindow: BrowserWindow | null = null
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

  const progress = new CombinedProgressManager(phaseTypes, phaseTotals, progressWindow);
  progress.start();

  // 各フェーズ共通の処理（フェーズ内は同時実行数を制限して並列化）
  async function processPhase(
    items: IconItem[],
    errorType: 'favicon' | 'icon',
    fetchFn: (item: IconItem) => Promise<string | null>,
    notFoundMsg: string,
    fallbackMsg: string,
    concurrency: number
  ): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};
    const failedEntries: { key: string; type: 'favicon' | 'icon'; errorMessage: string }[] = [];

    const tasks = items.map((item) => async () => {
      const displayText = getDisplayText(item);
      try {
        const result = await fetchFn(item);
        results[item.path] = result;

        if (result) {
          progress.update(displayText);
        } else {
          failedEntries.push({ key: item.path, type: errorType, errorMessage: notFoundMsg });
          progress.update(displayText, true, notFoundMsg);
        }
      } catch (error) {
        iconLogger.error({ path: item.path, error }, `${errorType} fetch error`);
        results[item.path] = null;
        const errorMsg = error instanceof Error ? error.message : fallbackMsg;
        failedEntries.push({ key: item.path, type: errorType, errorMessage: errorMsg });
        progress.update(displayText, true, errorMsg);
      }
    });

    await runWithConcurrency(tasks, concurrency);

    // エラーは1回のストア書き込みでまとめて記録
    await errorService.recordErrors(failedEntries);

    if (items.length > 0) progress.completePhase();
    return results;
  }

  const faviconResults = await processPhase(
    filteredUrlItems,
    'favicon',
    (item) => fetchIconForItem(item, folders, forceRefresh),
    'ファビコンが見つかりませんでした',
    'ファビコン取得に失敗しました',
    FAVICON_CONCURRENCY
  );

  const iconResults = await processPhase(
    filteredItems,
    'icon',
    (item) => fetchIconForItem(item, folders, forceRefresh),
    'アイコンが見つかりませんでした',
    'アイコン抽出に失敗しました',
    ICON_EXTRACT_CONCURRENCY
  );

  progress.completeAll();
  return { favicons: faviconResults, icons: iconResults };
}

/**
 * 渡されたアイテムのアイコンを取得する（進捗通知なし）
 *
 * メインウィンドウの一括取得の対象外にあるアイテム（ワークスペース専用のアイテム等）を
 * 補完するために用意している。取得できなかったアイテムはIconFetchErrorServiceに
 * 記録されるため、繰り返し呼び出しても同じアイテムを毎回取得し直すことはない。
 *
 * @returns 取得できたアイコンのみを含む path → dataURL のマップ
 */
async function ensureIcons(
  items: IconItem[],
  folders: IconFolders
): Promise<Record<string, string>> {
  const targets = items.filter((item) => isIconFetchTarget(item.type));
  if (targets.length === 0) return {};

  const { favicons, icons } = await fetchIconsCombined(
    targets.filter((item) => item.type === 'url'),
    targets.filter((item) => item.type !== 'url'),
    folders,
    false,
    null
  );

  const resolved: Record<string, string> = {};
  for (const [itemPath, icon] of [...Object.entries(favicons), ...Object.entries(icons)]) {
    if (icon) resolved[itemPath] = icon;
  }

  iconLogger.info(
    { requested: targets.length, resolved: Object.keys(resolved).length },
    'Ensured missing icons'
  );
  return resolved;
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

/**
 * アイテムタイプに応じて適切なアイコンを取得（統合API）。
 * サービス層からは services/iconService.ts のラッパー経由で利用する
 *
 * urlのファビコン、UWPアプリ、スクリプト系の扱いを含めて fetchIconForItem に委譲するため、
 * 呼び出し側でタイプごとに取得関数を選び分ける必要はない。
 */
export async function getIconForItem(
  filePath: string,
  itemType: LauncherItem['type'],
  originalPath?: string
): Promise<string | null> {
  return fetchIconForItem({ type: itemType, path: filePath, originalPath }, getIconFolders());
}

export function setupIconHandlers(
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string
) {
  const folders: IconFolders = {
    favicons: faviconsFolder,
    icons: iconsFolder,
    extensions: extensionsFolder,
  };

  ipcMain.handle(IPC_CHANNELS.FETCH_FAVICON, (_event, url: string) =>
    fetchFavicon(url, faviconsFolder)
  );

  ipcMain.handle(IPC_CHANNELS.EXTRACT_ICON, (_event, filePath: string) =>
    filePath.startsWith('shell:AppsFolder\\')
      ? extractUwpIcon(filePath, iconsFolder)
      : extractIcon(filePath, iconsFolder)
  );

  ipcMain.handle(IPC_CHANNELS.EXTRACT_FILE_ICON_BY_EXTENSION, (_event, filePath: string) =>
    extractFileIconByExtension(filePath, extensionsFolder)
  );

  ipcMain.handle(IPC_CHANNELS.EXTRACT_CUSTOM_URI_ICON, (_event, uri: string) =>
    extractCustomUriIcon(uri, iconsFolder)
  );

  ipcMain.handle(IPC_CHANNELS.LOAD_CACHED_ICONS, (_event, items: IconItem[]) =>
    loadCachedIcons(items, folders)
  );

  // 統合進捗API（進捗はメインウィンドウの進捗バーに表示する）
  ipcMain.handle(
    IPC_CHANNELS.FETCH_ICONS_COMBINED,
    (_event, urlItems: IconItem[], items: IconItem[], forceRefresh: boolean = false) =>
      fetchIconsCombined(urlItems, items, folders, forceRefresh, getMainWindow())
  );

  // キャッシュ欠損の補完API（進捗通知なし）
  ipcMain.handle(IPC_CHANNELS.ENSURE_ICONS, (_event, items: IconItem[]) =>
    ensureIcons(items, folders)
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
