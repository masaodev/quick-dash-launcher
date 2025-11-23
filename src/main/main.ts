import { app, globalShortcut } from 'electron';

import { setupIPCHandlers } from './ipc';
import { createDefaultDataFile } from './appHelpers';
import PathManager from './config/pathManager.js';
import { BackupService } from './services/backupService.js';
import { SettingsService } from './services/settingsService.js';
import { AutoLaunchService } from './services/autoLaunchService.js';
import {
  createWindow,
  createTray,
  registerGlobalShortcut,
  getMainWindow,
  getWindowPinState,
  setWindowPinState,
  setEditMode,
  getEditMode,
  getWindowPinMode,
  cycleWindowPinMode,
  setModalMode,
  setFirstLaunchMode,
} from './windowManager';
import { closeAdminWindow, setAppQuitting } from './adminWindowManager';
import { createSplashWindow, closeSplashWindow } from './splashWindowManager';

// 初回起動判定用のグローバル変数
let isFirstLaunch = false;

/**
 * 初回起動かどうかを取得
 */
export function getIsFirstLaunch(): boolean {
  return isFirstLaunch;
}

app.whenReady().then(async () => {
  // 設定フォルダを先に作成
  PathManager.ensureDirectories();

  // 初回起動判定: ホットキーが設定されているかどうかで判定
  const settingsService = await SettingsService.getInstance();
  const hotkey = await settingsService.get('hotkey');
  isFirstLaunch = !hotkey || hotkey.trim() === '';

  // アプリケーションのApp User Model IDを設定（Windows用）
  app.setAppUserModelId('net.masaodev.quick-dash-launcher');

  // 自動起動設定を適用（設定ファイルの値をシステムに反映）
  const autoLaunchService = AutoLaunchService.getInstance();
  const autoLaunchEnabled = await settingsService.get('autoLaunch');
  await autoLaunchService.setAutoLaunch(autoLaunchEnabled);

  // 初回起動モードを設定（初回起動時はフォーカス喪失やEscapeで閉じないようにする）
  setFirstLaunchMode(isFirstLaunch);

  // スプラッシュウィンドウを表示（E2Eテスト環境ではスキップ）
  if (process.env.SKIP_SPLASH_WINDOW !== '1') {
    await createSplashWindow();
  }

  // 初回起動時にデフォルトのdata.txtファイルを作成
  createDefaultDataFile();

  // 既存のデータファイルをタイムスタンプ付きでバックアップ（設定に基づく）
  const backupService = await BackupService.getInstance();
  await backupService.backupDataFiles(PathManager.getConfigFolder());

  // メインウィンドウを作成（設定サイズ、フレームレス、常に最前面）
  await createWindow();

  // システムトレイアイコンとコンテキストメニューを作成
  await createTray();

  // テスト環境の場合、ウィンドウを自動表示
  if (process.env.SHOW_WINDOW_ON_STARTUP === '1') {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  }

  // グローバルホットキーを登録（設定から読み込み）
  // テスト環境ではホットキーを無効化
  if (process.env.DISABLE_GLOBAL_HOTKEY !== '1') {
    await registerGlobalShortcut();
  }

  // レンダラープロセスとの通信用IPCハンドラーを設定
  setupIPCHandlers(
    PathManager.getConfigFolder(),
    PathManager.getFaviconsFolder(),
    PathManager.getIconsFolder(),
    PathManager.getExtensionsFolder(),
    getMainWindow,
    getWindowPinState,
    setWindowPinState,
    setEditMode,
    getEditMode,
    getWindowPinMode,
    cycleWindowPinMode,
    setModalMode,
    setFirstLaunchMode
  );

  // スプラッシュウィンドウはReactコンポーネントの完了信号(splash-ready)で閉じられる
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 管理ウィンドウの終了フラグを設定
  setAppQuitting(true);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  closeAdminWindow(); // 管理ウィンドウを確実に閉じる
  closeSplashWindow(); // スプラッシュウィンドウを確実に閉じる
});
