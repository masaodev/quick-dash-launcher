import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

import { ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { dataLogger } from '@common/logger';
import type { ScannedAppItem, AppScanResult, AppTargetType } from '@common/types/appImport';
import { generateId } from '@common/utils/jsonParser';

import { mainI18n } from '../services/mainI18n.js';

const execFileAsync = promisify(execFile);

/** 実行可能ファイルの拡張子（app種別として分類） */
const APP_EXTENSIONS = new Set([
  '.exe',
  '.com',
  '.bat',
  '.cmd',
  '.ps1',
  '.vbs',
  '.wsf',
  '.msi',
  '.msix',
  '.appx',
]);

/** アンインストーラーを示すショートカット名のパターン */
const UNINSTALLER_NAME_PATTERNS = [/uninstall/i, /アンインストール/];

/** アンインストーラーを示すターゲットファイル名のパターン（Inno Setup等） */
const UNINSTALLER_FILE_PATTERNS = [/^unins\d+\.exe$/i];

function detectTargetType(targetPath: string): AppTargetType {
  return APP_EXTENSIONS.has(path.extname(targetPath).toLowerCase()) ? 'app' : 'other';
}

function isUninstaller(targetPath: string, displayName: string): boolean {
  if (UNINSTALLER_NAME_PATTERNS.some((p) => p.test(displayName))) return true;
  const targetFileName = path.basename(targetPath);
  if (UNINSTALLER_FILE_PATTERNS.some((p) => p.test(targetFileName))) return true;
  return false;
}

/** フォルダを非同期で辿る（同期の fs だと、大きなスタートメニューの間メインプロセスが止まる） */
async function collectLnkFiles(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const subdirResults = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => collectLnkFiles(path.join(dirPath, entry.name)))
    );
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.lnk')) {
        results.push(path.join(dirPath, entry.name));
      }
    }
    for (const subdirResult of subdirResults) results.push(...subdirResult);
  } catch (error) {
    dataLogger.warn({ dirPath, error }, 'スタートメニューディレクトリのスキャンに失敗');
  }

  return results;
}

/** Get-StartAppsの結果の型 */
interface StartAppEntry {
  Name: string;
  AppID: string;
}

/** AppIDがファイルパス形式かどうかを判定する */
function isFilePathAppId(appId: string): boolean {
  // ドライブレター（C:\...）、環境変数パス（{GUID}\...）、UNCパス（\\...）などのファイルパス形式
  return /^[A-Za-z]:[/\\]/.test(appId) || appId.startsWith('{') || appId.startsWith('\\\\');
}

async function scanStartApps(): Promise<ScannedAppItem[]> {
  try {
    const { stdout: output } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-StartApps | ConvertTo-Json -Compress',
      ],
      { encoding: 'utf8', timeout: 15000 }
    );

    const parsed: StartAppEntry[] = JSON.parse(output);
    if (!Array.isArray(parsed)) return [];

    const startApps: ScannedAppItem[] = [];

    for (const entry of parsed) {
      if (!entry.Name || !entry.AppID) continue;

      // ファイルパス形式のAppIDはスキップ（shell:AppsFolderでは無効なパスになるため）
      if (isFilePathAppId(entry.AppID)) continue;

      // URIスキーマ形式（例: ms-settings://）はtargetType: 'other'として分類
      const isUri = entry.AppID.includes('://');
      const targetType: AppTargetType = isUri ? 'other' : 'app';
      const targetExtension = isUri
        ? entry.AppID.split('://')[0] + ':'
        : mainI18n.t('appImport.registeredApp');

      startApps.push({
        id: generateId(),
        displayName: entry.Name,
        shortcutPath: `shell:AppsFolder\\${entry.AppID}`,
        targetPath: `shell:AppsFolder\\${entry.AppID}`,
        checked: false,
        targetType,
        targetExtension,
        source: 'startapps',
        isUninstaller: false,
      });
    }

    dataLogger.info({ startAppCount: startApps.length }, '登録アプリのスキャンが完了');
    return startApps;
  } catch (error) {
    dataLogger.warn({ error }, '登録アプリのスキャンに失敗');
    return [];
  }
}

/** ショートカットをこの件数読むごとに、途中経過を送り、イベントループに番を返す */
const LNK_BATCH_SIZE = 10;

/**
 * @param onProgress ここまでに見つけた件数を受け取る（画面の「探しています…（N 件）」用）
 */
async function scanInstalledApps(onProgress?: (found: number) => void): Promise<AppScanResult> {
  const startTime = performance.now();

  // 登録アプリのスキャン（PowerShell）は待ち時間が長いため、ショートカットのスキャンと並行させる
  const startAppsPromise = scanStartApps();

  const programDataPath = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const appDataPath =
    process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');

  const startMenuPaths = [
    path.join(programDataPath, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(appDataPath, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ];

  const existingMenuPaths = (
    await Promise.all(
      startMenuPaths.map(async (menuPath) =>
        (await fs.promises.stat(menuPath).catch(() => null))?.isDirectory() ? menuPath : null
      )
    )
  ).filter((menuPath): menuPath is string => menuPath !== null);
  const allLnkFiles = (
    await Promise.all(existingMenuPaths.map((menuPath) => collectLnkFiles(menuPath)))
  ).flat();

  const apps: ScannedAppItem[] = [];

  for (const [index, lnkPath] of allLnkFiles.entries()) {
    // readShortcutLink は同期で 1 件数十 ms かかることがある。まとめて読むと、その間メインプロセスが止まり、
    // 全部のウィンドウが固まったように見える（200 件で 2〜3 秒）。ときどき番を返して、画面の操作を通す（A3-179）
    if (index > 0 && index % LNK_BATCH_SIZE === 0) {
      onProgress?.(apps.length);
      await new Promise((resolve) => setImmediate(resolve));
    }
    const baseName = path.basename(lnkPath, '.lnk');

    try {
      const shortcutDetails = shell.readShortcutLink(lnkPath);

      if (!shortcutDetails?.target) {
        continue;
      }

      const targetType = detectTargetType(shortcutDetails.target);
      const targetExtension = path.extname(shortcutDetails.target).toLowerCase();

      apps.push({
        id: generateId(),
        displayName: baseName,
        shortcutPath: lnkPath,
        targetPath: shortcutDetails.target,
        args: shortcutDetails.args?.trim() || undefined,
        checked: false,
        targetType,
        targetExtension: targetExtension || mainI18n.t('appImport.noExtension'),
        source: 'lnk',
        isUninstaller: isUninstaller(shortcutDetails.target, baseName),
      });
    } catch (error) {
      dataLogger.warn({ lnkPath, error }, 'ショートカットの読み込みに失敗（アプリスキャン）');
    }
  }

  // 登録アプリをスキャンしてマージ
  const startApps = await startAppsPromise;
  apps.push(...startApps);
  onProgress?.(apps.length);

  // 表示名でソート
  apps.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));

  const scanDuration = Math.round(performance.now() - startTime);
  dataLogger.info(
    { appCount: apps.length, startAppCount: startApps.length, scanDuration },
    'インストール済みアプリのスキャンが完了'
  );

  return { apps, scanDuration };
}

export function setupAppImportHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SCAN_INSTALLED_APPS, (event) =>
    scanInstalledApps((found) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.EVENT_APP_SCAN_PROGRESS, found);
      }
    })
  );
}
