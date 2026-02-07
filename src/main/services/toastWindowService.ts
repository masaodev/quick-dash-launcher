/**
 * トースト専用ウィンドウサービス（独立トースト）
 *
 * メインウィンドウが閉じた後でもトースト通知を表示するための
 * 小さな透明ウィンドウを管理します。
 *
 * @see docs/features/toast-notifications.md
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
  | 'windowOperation'
  | 'clipboard';

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
let isWindowReady = false;

function clearCloseTimeout(): void {
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }
}

/**
 * マウスカーソルがある画面でのトースト表示位置を計算
 */
function getToastPosition(): { x: number; y: number } {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { x: displayX, y: displayY } = display.workArea;
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;

  const x = displayX + Math.round((screenWidth - TOAST_WIDTH) / 2);
  const y = displayY + screenHeight - TOAST_HEIGHT - TOAST_MARGIN;

  return { x, y };
}

function createToastWindow(): BrowserWindow {
  const { x, y } = getToastPosition();

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
 * トーストウィンドウを事前準備（初回のみ作成・ロード）
 */
async function ensureToastWindow(): Promise<BrowserWindow> {
  // 既存ウィンドウが有効なら再利用
  if (toastWindow && !toastWindow.isDestroyed() && isWindowReady) {
    return toastWindow;
  }

  // 破棄済みまたは未作成の場合は新規作成
  toastWindow = createToastWindow();
  isWindowReady = false;

  // HTML読み込み
  if (EnvConfig.isDevelopment) {
    await toastWindow.loadURL(`${EnvConfig.devServerUrl}/toast.html`);
  } else {
    await toastWindow.loadFile(path.join(__dirname, '../toast.html'));
  }

  isWindowReady = true;
  return toastWindow;
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

  clearCloseTimeout();

  // ウィンドウを準備（初回のみ作成・ロード）
  const win = await ensureToastWindow();

  // トーストメッセージを送信して表示
  win.webContents.send('show-toast', {
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

  // マウスカーソルがある画面に位置を更新
  const { x, y } = getToastPosition();
  win.setPosition(x, y);

  // 最前面に表示されるようレベルを明示的に設定してから表示
  win.setAlwaysOnTop(true, 'pop-up-menu');
  if (!win.isVisible()) {
    win.show();
  }

  // 指定時間後に非表示（破棄はしない）
  closeTimeout = setTimeout(() => {
    closeTimeout = null;
    if (!win.isDestroyed()) {
      win.hide();
    }
  }, duration + 500);
}

/**
 * トーストウィンドウを即座に閉じる
 */
export function closeToastWindow(): void {
  clearCloseTimeout();

  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.hide();
  }
}

/**
 * アプリ終了時のクリーンアップ
 */
export function destroyToastWindow(): void {
  clearCloseTimeout();

  if (toastWindow && !toastWindow.isDestroyed()) {
    toastWindow.close();
    toastWindow = null;
    isWindowReady = false;
  }
}
