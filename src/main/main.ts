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
  backupDataFiles
} from './appHelpers';
import {
  createWindow,
  createTray,
  registerGlobalShortcut,
  getMainWindow
} from './windowManager';

// const store = new Store(); // 将来の使用のために予約

app.whenReady().then(() => {
  // 必要なディレクトリ（config, icons, favicons, schemes, backup）を作成
  ensureDirectories();
  
  // 初回起動時にデフォルトのdata.txtファイルを作成
  createDefaultDataFile();
  
  // 既存のデータファイルをタイムスタンプ付きでバックアップ
  backupDataFiles();
  
  // メインウィンドウを作成（479x506px、フレームレス、常に最前面）
  createWindow();
  
  // システムトレイアイコンとコンテキストメニューを作成
  createTray();
  
  // グローバルホットキー（Ctrl+Alt+W）を登録
  registerGlobalShortcut();
  
  // レンダラープロセスとの通信用IPCハンドラーを設定
  setupIPCHandlers(CONFIG_FOLDER, FAVICONS_FOLDER, ICONS_FOLDER, EXTENSIONS_FOLDER, getMainWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});