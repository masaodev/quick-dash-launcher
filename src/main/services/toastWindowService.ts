/**
 * トースト専用ウィンドウサービス
 *
 * メインウィンドウが閉じた後でもトースト通知を表示するための
 * 小さな透明ウィンドウを管理します。
 */

import * as path from 'path';

import { BrowserWindow, screen, app } from 'electron';

import { NotificationType } from './notificationService.js';

/** トースト通知の種類（NotificationTypeのエイリアス） */
export type ToastType = NotificationType;

/** トースト表示オプション */
export interface ToastOptions {
  /** 表示メッセージ */
  message: string;
  /** トーストの種類 */
  type?: ToastType;
  /** 表示時間（ミリ秒） */
  duration?: number;
}

// トーストウィンドウの設定
const TOAST_WIDTH = 320;
const TOAST_HEIGHT = 80;
const TOAST_MARGIN = 16;
const DEFAULT_DURATION = 2500;

// 現在のトーストウィンドウ
let toastWindow: BrowserWindow | null = null;
let closeTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * タイムアウトとウィンドウをクリーンアップする
 */
function cleanup(): void {
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }

  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.close();
    toastWindow = null;
  }
}

/**
 * トーストウィンドウを作成して表示する
 */
function createToastWindow(): BrowserWindow {
  // プライマリディスプレイのサイズを取得
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // 画面中央下に配置
  const x = Math.round((screenWidth - TOAST_WIDTH) / 2);
  const y = screenHeight - TOAST_HEIGHT - TOAST_MARGIN;

  const win = new BrowserWindow({
    width: TOAST_WIDTH,
    height: TOAST_HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // クリックを透過させる（Windows）
  win.setIgnoreMouseEvents(true, { forward: true });

  return win;
}

/**
 * トースト通知を表示する
 */
export async function showToastWindow(options: ToastOptions): Promise<void> {
  const { message, type = 'success', duration = DEFAULT_DURATION } = options;

  // 既存のウィンドウをクリーンアップ
  cleanup();

  // 新しいウィンドウを作成
  toastWindow = createToastWindow();

  // トースト用HTMLを読み込み
  const isDev = !app.isPackaged;
  const port = process.env.VITE_PORT || '9001';

  if (isDev) {
    await toastWindow.loadURL(`http://localhost:${port}/toast.html`);
  } else {
    await toastWindow.loadFile(path.join(__dirname, '../renderer/toast.html'));
  }

  // トーストの内容を設定
  toastWindow.webContents.send('show-toast', { message, type, duration });

  // ウィンドウを表示
  toastWindow.show();

  // 指定時間後にウィンドウを閉じる
  closeTimeout = setTimeout(() => {
    closeTimeout = null; // タイムアウト完了をマーク
    if (toastWindow && !toastWindow.isDestroyed()) {
      toastWindow.close();
      toastWindow = null;
    }
  }, duration + 500); // フェードアウトのための余裕を持たせる
}

/**
 * トーストウィンドウを即座に閉じる
 */
export function closeToastWindow(): void {
  cleanup();
}
