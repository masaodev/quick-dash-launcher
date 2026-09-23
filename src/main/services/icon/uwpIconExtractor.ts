import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

import { iconLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';

import { extractPackageFamilyName } from '../../utils/iconCacheKeys.js';

import { cacheAndConvertIcon } from './iconFileCache.js';

const execAsync = promisify(exec);

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
export async function extractUwpIcon(appPath: string, iconsFolder: string): Promise<string | null> {
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
 * レジストリからは実行ファイルを解決できない。
 * パッケージマニフェストの windows.protocol 宣言から逆引きする
 */
export async function extractUwpIconByUriScheme(
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
