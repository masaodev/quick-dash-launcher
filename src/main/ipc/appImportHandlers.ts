/**
 * アプリインポート機能のIPCハンドラー
 * スタートメニューの.lnkファイルをスキャンしてアプリ一覧を返す
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

import { ipcMain, shell } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { dataLogger } from '@common/logger';
import type { ScannedAppItem, AppScanResult, AppTargetType } from '@common/types/appImport';
import { generateId } from '@common/utils/jsonParser';

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

/**
 * ターゲットパスからファイル種別を判定する（拡張子のみ）
 */
function detectTargetType(targetPath: string): AppTargetType {
  return APP_EXTENSIONS.has(path.extname(targetPath).toLowerCase()) ? 'app' : 'other';
}

/**
 * アンインストーラーかどうかを判定する
 */
function isUninstaller(targetPath: string, displayName: string): boolean {
  if (UNINSTALLER_NAME_PATTERNS.some((p) => p.test(displayName))) return true;
  const targetFileName = path.basename(targetPath);
  if (UNINSTALLER_FILE_PATTERNS.some((p) => p.test(targetFileName))) return true;
  return false;
}

/**
 * ディレクトリを再帰的にスキャンして.lnkファイルを収集
 */
function collectLnkFiles(dirPath: string): string[] {
  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectLnkFiles(fullPath));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lnk')) {
        results.push(fullPath);
      }
    }
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

/**
 * PowerShellのGet-StartAppsを使って登録アプリをスキャンする
 */
function scanStartApps(): ScannedAppItem[] {
  try {
    const output = execSync(
      'powershell.exe -NoProfile -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-StartApps | ConvertTo-Json -Compress"',
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
      const targetExtension = isUri ? entry.AppID.split('://')[0] + ':' : '(登録アプリ)';

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

/**
 * スタートメニューからインストール済みアプリをスキャンする
 */
function scanInstalledApps(): AppScanResult {
  const startTime = performance.now();

  const programDataPath = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const appDataPath =
    process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');

  const startMenuPaths = [
    path.join(programDataPath, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(appDataPath, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ];

  const allLnkFiles = startMenuPaths
    .filter((menuPath) => fs.existsSync(menuPath))
    .flatMap((menuPath) => collectLnkFiles(menuPath));

  const apps: ScannedAppItem[] = [];

  for (const lnkPath of allLnkFiles) {
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
        targetExtension: targetExtension || '(なし)',
        source: 'lnk',
        isUninstaller: isUninstaller(shortcutDetails.target, baseName),
      });
    } catch (error) {
      dataLogger.warn({ lnkPath, error }, 'ショートカットの読み込みに失敗（アプリスキャン）');
    }
  }

  // 登録アプリをスキャンしてマージ
  const startApps = scanStartApps();
  apps.push(...startApps);

  // 表示名でソート
  apps.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));

  const scanDuration = Math.round(performance.now() - startTime);
  dataLogger.info(
    { appCount: apps.length, startAppCount: startApps.length, scanDuration },
    'インストール済みアプリのスキャンが完了'
  );

  return { apps, scanDuration };
}

/**
 * アプリインポート関連のIPCハンドラーを登録する
 */
export function setupAppImportHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SCAN_INSTALLED_APPS, () => scanInstalledApps());
}
