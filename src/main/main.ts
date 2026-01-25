import * as path from 'path';

import { app, globalShortcut } from 'electron';

import { setupIPCHandlers } from './ipc';
import { createDefaultDataFile } from './utils/appHelpers';
import PathManager from './config/pathManager.js';
import { EnvConfig } from './config/envConfig.js';
import { BackupService } from './services/backupService.js';
import { SettingsService } from './services/settingsService.js';
import { AutoLaunchService } from './services/autoLaunchService.js';
import {
  createWindow,
  createTray,
  getMainWindow,
  setEditMode,
  getEditMode,
  getWindowPinMode,
  cycleWindowPinMode,
  setModalMode,
  setFirstLaunchMode,
} from './windowManager';
import { closeAdminWindow, setAppQuitting as setAdminAppQuitting } from './adminWindowManager';
import { createSplashWindow, closeSplashWindow } from './splashWindowManager';
import {
  createWorkspaceWindow,
  closeWorkspaceWindow,
  setAppQuitting as setWorkspaceAppQuitting,
} from './workspaceWindowManager';

// 初回起動判定用のグローバル変数
let isFirstLaunch = false;

/**
 * 初回起動かどうかを取得
 */
export function getIsFirstLaunch(): boolean {
  return isFirstLaunch;
}

// 多重起動時に完全に独立したuserDataを使用
if (EnvConfig.hasAppInstance) {
  const appName = `${EnvConfig.appInstance}-quick-dash-launcher`;
  const userDataPath = path.join(app.getPath('appData'), appName);
  app.setPath('userData', userDataPath);
}

// 開発モード時にリモートデバッグポートを有効化（Playwright MCP用）
if (EnvConfig.isDevelopment) {
  // APP_INSTANCEごとに異なるポートを使用してポート競合を回避
  // dev:testはPlaywright MCP用に固定ポート9222を使用、それ以外は動的割り当て
  const isTestMode = EnvConfig.customConfigDir?.includes('tests/dev/full');
  const debugPort = isTestMode ? '9222' : '0'; // 0 = 自動的に空いているポートを割り当て
  app.commandLine.appendSwitch('--remote-debugging-port', debugPort);
}

app.whenReady().then(async () => {
  // 設定フォルダを先に作成
  PathManager.ensureDirectories();

  // 初回起動判定: ホットキーが設定されているかどうかで判定
  const settingsService = await SettingsService.getInstance();
  const hotkey = await settingsService.get('hotkey');
  isFirstLaunch = !hotkey || hotkey.trim() === '';

  // アプリケーションのApp User Model IDを設定（Windows用）
  // 開発モード時は異なるIDを使用してアイコンキャッシュの問題を回避
  const appUserModelId = EnvConfig.isDevelopment
    ? 'net.masaodev.quick-dash-launcher.dev'
    : 'net.masaodev.quick-dash-launcher';
  app.setAppUserModelId(appUserModelId);

  // 自動起動設定を適用（設定ファイルの値をシステムに反映）
  const autoLaunchService = AutoLaunchService.getInstance();
  const autoLaunchEnabled = await settingsService.get('autoLaunch');
  await autoLaunchService.setAutoLaunch(autoLaunchEnabled);

  // 初回起動モードを設定（初回起動時はフォーカス喪失やEscapeで閉じないようにする）
  setFirstLaunchMode(isFirstLaunch);

  // スプラッシュウィンドウを表示（E2Eテスト環境ではスキップ）
  if (!EnvConfig.skipSplashWindow) {
    await createSplashWindow();
  }

  // 初回起動時にデフォルトのdata.jsonファイルを作成
  createDefaultDataFile();

  // 既存のデータファイルをタイムスタンプ付きでバックアップ（設定に基づく）
  const backupService = await BackupService.getInstance();
  await backupService.backupDataFiles(PathManager.getConfigFolder());

  // メインウィンドウを作成（設定サイズ、フレームレス、常に最前面）
  await createWindow();

  // システムトレイアイコンとコンテキストメニューを作成
  await createTray();

  // テスト環境の場合、ウィンドウを自動表示
  if (EnvConfig.showWindowOnStartup) {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  }

  // レンダラープロセスとの通信用IPCハンドラーを設定
  setupIPCHandlers(
    PathManager.getConfigFolder(),
    PathManager.getFaviconsFolder(),
    PathManager.getIconsFolder(),
    PathManager.getExtensionsFolder(),
    getMainWindow,
    setEditMode,
    getEditMode,
    getWindowPinMode,
    cycleWindowPinMode,
    setModalMode,
    setFirstLaunchMode
  );

  // ワークスペースウィンドウを作成（起動時は表示しない、ユーザーが手動で起動したときのみ表示）
  await createWorkspaceWindow();

  // スプラッシュウィンドウとホットキー登録はsplash-readyハンドラー内で処理される
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 管理ウィンドウとワークスペースウィンドウの終了フラグを設定
  setAdminAppQuitting(true);
  setWorkspaceAppQuitting(true);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  closeAdminWindow(); // 管理ウィンドウを確実に閉じる
  closeWorkspaceWindow(); // ワークスペースウィンドウを確実に閉じる
  closeSplashWindow(); // スプラッシュウィンドウを確実に閉じる
});
