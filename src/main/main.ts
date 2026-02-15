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
import { destroyToastWindow } from './services/toastWindowService.js';
import { BookmarkAutoImportService } from './services/bookmarkAutoImportService.js';

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
  // 設定フォルダを先に作成（スプラッシュのアイコンパス解決に必要）
  PathManager.ensureDirectories();

  // スプラッシュウィンドウを最速で表示（E2Eテスト環境ではスキップ）
  if (!EnvConfig.skipSplashWindow) {
    await createSplashWindow();
  }

  // 以下はスプラッシュ表示後にバックグラウンドで初期化
  const settingsService = await SettingsService.getInstance();

  // 初回起動判定: ホットキーが未設定なら初回起動
  const hotkey = await settingsService.get('hotkey');
  const isFirstLaunch = !hotkey?.trim();

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

  // 初回起動時にデフォルトのdata.jsonファイルを作成
  createDefaultDataFile();

  // 起動時スナップショットバックアップ（fire-and-forget: メインフローをブロックしない）
  BackupService.getInstance()
    .then((s) => s.createSnapshot())
    .catch((error) => {
      console.error('起動時バックアップでエラー:', error);
    });

  // レンダラープロセスとの通信用IPCハンドラーを設定（ハンドラー登録のみなのでウィンドウ作成前に実行可能）
  setupIPCHandlers(
    PathManager.getConfigFolder(),
    PathManager.getFaviconsFolder(),
    PathManager.getAppsFolder(),
    PathManager.getExtensionsFolder(),
    getMainWindow,
    setEditMode,
    getEditMode,
    getWindowPinMode,
    cycleWindowPinMode,
    setModalMode,
    setFirstLaunchMode
  );

  // メインウィンドウ・トレイ・ワークスペースを並列作成（互いに独立）
  await Promise.all([
    createWindow(),
    createTray(),
    createWorkspaceWindow(),
  ]);

  // テスト環境の場合、ウィンドウを自動表示（createWindow完了後に実行）
  if (EnvConfig.showWindowOnStartup) {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  }

  // ブックマーク自動取込の起動時実行
  const bookmarkAutoImportService = new BookmarkAutoImportService();
  bookmarkAutoImportService.executeOnStartup().catch((error) => {
    console.error('ブックマーク自動取込の起動時実行でエラー:', error);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  setAdminAppQuitting(true);
  setWorkspaceAppQuitting(true);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  closeAdminWindow();
  closeWorkspaceWindow();
  closeSplashWindow();
  destroyToastWindow();
});
