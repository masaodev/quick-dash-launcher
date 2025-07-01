import { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
// import Store from 'electron-store'; // 将来の使用のために予約
import { setupIPCHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
// const store = new Store(); // 将来の使用のために予約

const HOTKEY = 'Ctrl+Alt+W';
const CONFIG_FOLDER = path.join(app.getPath('userData'), 'config');
const ICONS_FOLDER = path.join(CONFIG_FOLDER, 'icons');
const FAVICONS_FOLDER = path.join(CONFIG_FOLDER, 'favicons');
const SCHEMES_FOLDER = path.join(ICONS_FOLDER, 'schemes');
const BACKUP_FOLDER = path.join(CONFIG_FOLDER, 'backup');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 479,
    height: 506,
    center: true,
    alwaysOnTop: true,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:9000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }
  
  // デバッグ用：開発者ツールを開く
  // mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      event.preventDefault();
      if (mainWindow) {
        mainWindow.hide();
      }
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '表示',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: '終了',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('QuickDashLauncher');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function registerGlobalShortcut() {
  const ret = globalShortcut.register(HOTKEY, () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('window-shown');
      }
    }
  });

  if (!ret) {
    console.log('ホットキーの登録に失敗しました');
  }
}

function ensureDirectories() {
  const dirs = [CONFIG_FOLDER, ICONS_FOLDER, FAVICONS_FOLDER, SCHEMES_FOLDER, BACKUP_FOLDER];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function createDefaultDataFile() {
  const dataPath = path.join(CONFIG_FOLDER, 'data.txt');
  if (!fs.existsSync(dataPath)) {
    const defaultContent = `// Webサイト
GitHub,https://github.com/
Google マップ,https://www.google.co.jp/maps

// ローカルフォルダ
デスクトップ,shell:Desktop
ダウンロード,shell:Downloads

// アプリケーション
メモ帳,notepad.exe
`;
    fs.writeFileSync(dataPath, defaultContent, 'utf8');
  }
}

function backupDataFiles() {
  const timestamp = new Date().toISOString().replace(/:/g, '-').substring(0, 19);
  const files = ['data.txt', 'data2.txt', 'tempdata.txt'];
  
  files.forEach(file => {
    const sourcePath = path.join(CONFIG_FOLDER, file);
    if (fs.existsSync(sourcePath)) {
      const backupPath = path.join(BACKUP_FOLDER, `${file}.${timestamp}`);
      fs.copyFileSync(sourcePath, backupPath);
    }
  });
}

app.whenReady().then(() => {
  ensureDirectories();
  createDefaultDataFile();
  backupDataFiles();
  
  createWindow();
  createTray();
  registerGlobalShortcut();
  
  // IPCハンドラーのセットアップ
  setupIPCHandlers(CONFIG_FOLDER, FAVICONS_FOLDER, getMainWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}