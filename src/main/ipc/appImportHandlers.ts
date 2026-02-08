/**
 * アプリインポート機能のIPCハンドラー
 * スタートメニューの.lnkファイルをスキャンしてアプリ一覧を返す
 */

import * as path from 'path';
import * as fs from 'fs';

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
 * ターゲットパスとショートカット名からファイル種別を判定する
 */
function detectTargetType(targetPath: string, displayName: string): AppTargetType {
  const ext = path.extname(targetPath).toLowerCase();
  if (!APP_EXTENSIONS.has(ext)) return 'other';
  if (UNINSTALLER_NAME_PATTERNS.some((p) => p.test(displayName))) return 'other';
  const targetFileName = path.basename(targetPath);
  if (UNINSTALLER_FILE_PATTERNS.some((p) => p.test(targetFileName))) return 'other';
  return 'app';
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

/**
 * スタートメニューからインストール済みアプリをスキャンする
 */
function scanInstalledApps(): AppScanResult {
  const startTime = performance.now();

  // スタートメニューの2箇所をスキャン
  const programDataPath = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const appDataPath =
    process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');

  const startMenuPaths = [
    path.join(programDataPath, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(appDataPath, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ];

  // .lnkファイルを収集
  const allLnkFiles = startMenuPaths
    .filter((menuPath) => fs.existsSync(menuPath))
    .flatMap((menuPath) => collectLnkFiles(menuPath));

  // .lnkファイルを解析してアプリ情報を取得
  const apps: ScannedAppItem[] = [];
  const seenTargets = new Set<string>();

  for (const lnkPath of allLnkFiles) {
    const baseName = path.basename(lnkPath, '.lnk');

    try {
      const shortcutDetails = shell.readShortcutLink(lnkPath);

      if (!shortcutDetails?.target) {
        continue;
      }

      // ターゲットパスで重複排除（同一アプリが両スタートメニューにある場合）
      const normalizedTarget = shortcutDetails.target.toLowerCase();
      if (seenTargets.has(normalizedTarget)) {
        continue;
      }
      seenTargets.add(normalizedTarget);

      const targetType = detectTargetType(shortcutDetails.target, baseName);
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
      });
    } catch (error) {
      dataLogger.warn({ lnkPath, error }, 'ショートカットの読み込みに失敗（アプリスキャン）');
    }
  }

  // 表示名でソート
  apps.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));

  const scanDuration = Math.round(performance.now() - startTime);
  dataLogger.info(
    { appCount: apps.length, scanDuration },
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
