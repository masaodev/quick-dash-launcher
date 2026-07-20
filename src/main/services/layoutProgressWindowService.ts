/**
 * レイアウト進捗ミニウィンドウサービス
 *
 * レイアウト実行中の進捗をフレームレスのミニウィンドウで表示する。
 * トーストウィンドウと同様のパターンで、ウィンドウを再利用する。
 */

import * as path from 'path';

import { BrowserWindow, screen } from 'electron';

import { EnvConfig } from '../config/envConfig.js';
import { WindowIdleDestroyer } from '../utils/windowIdleDestroyer.js';

const WINDOW_WIDTH = 400;
const WINDOW_HEIGHT = 300;
const IDLE_DESTROY_MS = 5 * 60 * 1000;

let progressWindow: BrowserWindow | null = null;
let isWindowReady = false;
let pendingEnsure: Promise<BrowserWindow> | null = null;

// 非表示のまま放置されたウィンドウを破棄してレンダラープロセスを解放する
const idleDestroyer = new WindowIdleDestroyer(IDLE_DESTROY_MS, () => {
  if (isWindowValid() && !progressWindow!.isVisible()) {
    destroyLayoutProgressWindow();
  }
});

function isWindowValid(): boolean {
  return progressWindow !== null && !progressWindow.isDestroyed();
}

function getWindowPosition(): { x: number; y: number } {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { x: displayX, y: displayY } = display.workArea;
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;

  const x = displayX + Math.round((screenWidth - WINDOW_WIDTH) / 2);
  const y = displayY + Math.round((screenHeight - WINDOW_HEIGHT) / 2);

  return { x, y };
}

function createWindow(): BrowserWindow {
  const { x, y } = getWindowPosition();

  return new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    focusable: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
}

async function ensureWindow(): Promise<BrowserWindow> {
  if (isWindowValid() && isWindowReady) {
    return progressWindow!;
  }

  // 同時呼び出し時は進行中のPromiseを再利用
  if (pendingEnsure) {
    return pendingEnsure;
  }

  pendingEnsure = (async () => {
    progressWindow = createWindow();
    isWindowReady = false;

    if (EnvConfig.isDevelopment) {
      await progressWindow.loadURL(`${EnvConfig.devServerUrl}/layout-progress.html`);
    } else {
      await progressWindow.loadFile(path.join(__dirname, '../layout-progress.html'));
    }

    isWindowReady = true;
    pendingEnsure = null;
    return progressWindow;
  })();

  return pendingEnsure;
}

export async function showLayoutProgressWindow(): Promise<BrowserWindow> {
  idleDestroyer.cancel();
  const win = await ensureWindow();

  const { x, y } = getWindowPosition();
  win.setPosition(x, y);
  win.setAlwaysOnTop(true, 'pop-up-menu');

  if (!win.isVisible()) {
    win.show();
  }

  return win;
}

export function hideLayoutProgressWindow(): void {
  if (isWindowValid()) {
    progressWindow!.hide();
    idleDestroyer.schedule();
  }
}

export function getLayoutProgressWindow(): BrowserWindow | null {
  return isWindowValid() ? progressWindow : null;
}

export function destroyLayoutProgressWindow(): void {
  idleDestroyer.cancel();
  if (isWindowValid()) {
    progressWindow!.close();
    progressWindow = null;
  }
  isWindowReady = false;
}
