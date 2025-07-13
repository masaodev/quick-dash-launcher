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
  backupDataFiles,
} from './appHelpers';
import {
  createWindow,
  createTray,
  registerGlobalShortcut,
  getMainWindow,
  getWindowPinState,
  setWindowPinState,
  setEditMode,
  getEditMode,
} from './windowManager';
import { closeAdminWindow } from './adminWindowManager';

// const store = new Store(); // 将来の使用のために予約

app.whenReady().then(async () => {
  // 必要なディレクトリ（config, icons, favicons, schemes, backup）を作成
  ensureDirectories();

  // 初回起動時にデフォルトのdata.txtファイルを作成
  createDefaultDataFile();

  // 既存のデータファイルをタイムスタンプ付きでバックアップ
  backupDataFiles();

  // メインウィンドウを作成（設定サイズ、フレームレス、常に最前面）
  await createWindow();

  // システムトレイアイコンとコンテキストメニューを作成
  createTray();

  // グローバルホットキーを登録（設定から読み込み）
  await registerGlobalShortcut();

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
    getEditMode
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
