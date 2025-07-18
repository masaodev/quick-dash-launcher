import * as path from 'path';

import { BrowserWindow, Tray, Menu, nativeImage, app } from 'electron';
import { windowLogger } from '@common/logger';

import { HotkeyService } from './services/hotkeyService.js';
import { SettingsService } from './services/settingsService.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isPinned: boolean = false;
let isEditMode: boolean = false;
let normalWindowBounds: { width: number; height: number } | null = null;

/**
 * アプリケーションのメインウィンドウを作成し、初期設定を行う
 * 常に最前面に表示され、フレームレスで中央に配置される
 * フォーカス喪失時の自動非表示やESCキーでの終了など、ランチャーアプリとしての動作を設定
 *
 * @returns 作成されたBrowserWindowインスタンス
 * @throws Error ウィンドウの作成やコンテンツの読み込みに失敗した場合
 *
 * @example
 * ```typescript
 * const window = createWindow();
 * window.show();
 * ```
 */
export async function createWindow(): Promise<BrowserWindow> {
  const settingsService = await SettingsService.getInstance();
  const windowWidth = await settingsService.get('windowWidth');
  const windowHeight = await settingsService.get('windowHeight');

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
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
  mainWindow.webContents.session.webRequest.onBeforeRequest((_details, callback) => {
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

export async function registerGlobalShortcut(): Promise<void> {
  try {
    const hotkeyService = HotkeyService.getInstance(() => mainWindow);
    const success = await hotkeyService.registerHotkey();

    if (!success) {
      windowLogger.warn('ホットキーの登録に失敗しました');
    }
  } catch (error) {
    windowLogger.error('ホットキーサービスの初期化に失敗しました:', error);
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

/**
 * アプリケーションの編集モードを設定し、それに応じてウィンドウサイズを調整する
 * 編集モード時はウィンドウサイズを拡大し、通常モード時は元のサイズに戻す
 * 編集モード中はフォーカス喪失時に自動非表示されないように制御される
 *
 * @param editMode - 編集モードのON/OFF（true: 編集モード、false: 通常モード）
 *
 * @example
 * ```typescript
 * // 編集モードを有効にする
 * setEditMode(true);
 *
 * // 編集モードを無効にする
 * setEditMode(false);
 * ```
 */
export async function setEditMode(editMode: boolean): Promise<void> {
  isEditMode = editMode;

  if (mainWindow) {
    const settingsService = await SettingsService.getInstance();

    if (editMode) {
      // 編集モードに入る時：現在のサイズを保存してから大きくする
      const currentBounds = mainWindow.getBounds();
      normalWindowBounds = { width: currentBounds.width, height: currentBounds.height };
      const editWidth = await settingsService.get('editModeWidth');
      const editHeight = await settingsService.get('editModeHeight');
      mainWindow.setSize(editWidth, editHeight);
      mainWindow.center();
    } else {
      // 通常モードに戻る時：元のサイズに戻す
      if (normalWindowBounds) {
        mainWindow.setSize(normalWindowBounds.width, normalWindowBounds.height);
        mainWindow.center();
      } else {
        // normalWindowBoundsが無い場合は設定値を使用
        const normalWidth = await settingsService.get('windowWidth');
        const normalHeight = await settingsService.get('windowHeight');
        mainWindow.setSize(normalWidth, normalHeight);
        mainWindow.center();
      }
    }
  }
}

export function getEditMode(): boolean {
  return isEditMode;
}
