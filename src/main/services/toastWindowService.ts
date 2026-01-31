/**
 * トースト専用ウィンドウサービス
 *
 * メインウィンドウが閉じた後でもトースト通知を表示するための
 * 小さな透明ウィンドウを管理します。
 */

import * as path from 'path';

import { BrowserWindow, screen } from 'electron';

import { EnvConfig } from '../config/envConfig.js';

import { NotificationType } from './notificationService.js';

/** アイテムタイプ */
export type ToastItemType =
  | 'url'
  | 'file'
  | 'folder'
  | 'app'
  | 'customUri'
  | 'group'
  | 'windowOperation';

/** トースト表示オプション */
export interface ToastOptions {
  /** 表示メッセージ（従来互換用） */
  message?: string;
  /** トーストの種類 */
  type?: NotificationType;
  /** 表示時間（ミリ秒） */
  duration?: number;
  /** アイテムタイプ */
  itemType?: ToastItemType;
  /** 表示名 */
  displayName?: string;
  /** パス（URL含む） */
  path?: string;
  /** アイコン（Base64データURLまたはURL） */
  icon?: string;
  /** グループ内アイテム数 */
  itemCount?: number;
  /** グループ内アイテム名（最大3件） */
  itemNames?: string[];
}

const TOAST_WIDTH = 400;
const TOAST_HEIGHT = 100;
const TOAST_MARGIN = 16;
const DEFAULT_DURATION = 2500;

let toastWindow: BrowserWindow | null = null;
let closeTimeout: ReturnType<typeof setTimeout> | null = null;

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

function createToastWindow(): BrowserWindow {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

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

  win.setIgnoreMouseEvents(true, { forward: true });

  return win;
}

/**
 * トースト通知を表示する
 */
export async function showToastWindow(options: ToastOptions): Promise<void> {
  const {
    message,
    type = 'success',
    duration: customDuration,
    itemType,
    displayName,
    path: itemPath,
    icon,
    itemCount,
    itemNames,
  } = options;

  // グループ起動時は表示時間を長め（3秒）に設定
  const duration = customDuration ?? (itemType === 'group' ? 3000 : DEFAULT_DURATION);

  cleanup();
  toastWindow = createToastWindow();

  if (EnvConfig.isDevelopment) {
    await toastWindow.loadURL(`${EnvConfig.devServerUrl}/toast.html`);
  } else {
    await toastWindow.loadFile(path.join(__dirname, '../toast.html'));
  }

  // 拡張データを送信
  toastWindow.webContents.send('show-toast', {
    message,
    type,
    duration,
    itemType,
    displayName,
    path: itemPath,
    icon,
    itemCount,
    itemNames,
  });
  toastWindow.show();

  closeTimeout = setTimeout(() => {
    closeTimeout = null;
    if (toastWindow && !toastWindow.isDestroyed()) {
      toastWindow.close();
      toastWindow = null;
    }
  }, duration + 500);
}

/**
 * トーストウィンドウを即座に閉じる
 */
export function closeToastWindow(): void {
  cleanup();
}
