import * as path from 'path';

import { BrowserWindow, globalShortcut, Tray, Menu, nativeImage, app } from 'electron';

import { HOTKEY } from './appHelpers';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isPinned: boolean = false;
let isEditMode: boolean = false;
let normalWindowBounds: { width: number; height: number } | null = null;

export function createWindow(): BrowserWindow {
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
    if (mainWindow && !mainWindow.webContents.isDevToolsOpened() && !isPinned && !isEditMode) {
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

  // Enable webSecurity for file drag and drop
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: false });
  });

  return mainWindow;
}

export function createTray(): void {
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

export function registerGlobalShortcut(): void {
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

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function getWindowPinState(): boolean {
  return isPinned;
}

export function setWindowPinState(pinState: boolean): void {
  isPinned = pinState;
}

export function setEditMode(editMode: boolean): void {
  isEditMode = editMode;

  if (mainWindow) {
    if (editMode) {
      // 編集モードに入る時：現在のサイズを保存してから大きくする
      const currentBounds = mainWindow.getBounds();
      normalWindowBounds = { width: currentBounds.width, height: currentBounds.height };
      mainWindow.setSize(1000, 700);
      mainWindow.center();
    } else {
      // 通常モードに戻る時：元のサイズに戻す
      if (normalWindowBounds) {
        mainWindow.setSize(normalWindowBounds.width, normalWindowBounds.height);
        mainWindow.center();
      }
    }
  }
}

export function getEditMode(): boolean {
  return isEditMode;
}
