import { app, globalShortcut } from 'electron';

// import Store from 'electron-store'; // 将来の使用のために予約
import { setupIPCHandlers } from './ipc';
import {
  CONFIG_FOLDER,
  FAVICONS_FOLDER,
  ICONS_FOLDER,
  EXTENSIONS_FOLDER,
  ensureDirectories,
  createDefaultDataFile,
} from './appHelpers';
import { BackupService } from './services/backupService.js';
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
} from './windowManager';
import { closeAdminWindow } from './adminWindowManager';

// const store = new Store(); // 将来の使用のために予約

app.whenReady().then(async () => {
  // アプリケーションのApp User Model IDを設定（Windows用）
  app.setAppUserModelId('com.example.quick-dash-launcher');

  // 必要なディレクトリ（config, icons, favicons, schemes, backup）を作成
  ensureDirectories();

  // 初回起動時にデフォルトのdata.txtファイルを作成
  createDefaultDataFile();

  // 既存のデータファイルをタイムスタンプ付きでバックアップ（設定に基づく）
  const backupService = await BackupService.getInstance();
  await backupService.backupDataFiles(CONFIG_FOLDER);

  // メインウィンドウを作成（設定サイズ、フレームレス、常に最前面）
  await createWindow();

  // システムトレイアイコンとコンテキストメニューを作成
  createTray();

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
    CONFIG_FOLDER,
    FAVICONS_FOLDER,
    ICONS_FOLDER,
    EXTENSIONS_FOLDER,
    getMainWindow,
    getWindowPinState,
    setWindowPinState,
    setEditMode,
    getEditMode,
    getWindowPinMode,
    cycleWindowPinMode,
    setModalMode
  );
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  closeAdminWindow(); // 管理ウィンドウを確実に閉じる
});
