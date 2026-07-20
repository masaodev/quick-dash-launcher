/**
 * オーバーレイウィンドウサービス（トースト＋レイアウト進捗の共用）
 *
 * どちらも小型の透過・最前面ウィンドウであるため、1枚のウィンドウを
 * モードに応じてサイズ・位置・操作可否を切り替えて使い回す。
 * レンダラープロセスの固定費（実測WS約100MB）を1枚分に抑えるための統合。
 *
 * 表示ポリシー: レイアウト進捗の表示中はトーストを表示しない（進捗の方が
 * 情報量が多く、レイアウト実行は数秒〜数十秒で終わるため）。
 *
 * @see docs/features/toast-notifications.md
 */

import * as path from 'path';

import { BrowserWindow, screen } from 'electron';
import type { ToastItemType } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { EnvConfig } from '../config/envConfig.js';
import { WindowIdleDestroyer } from '../utils/windowIdleDestroyer.js';

import { NotificationType } from './notificationService.js';

/**
 * トースト表示オプション
 *
 * 必ず itemType + displayName を指定してリッチ形式で表示すること。
 * message + type のみの旧形式（シンプルデザイン）は非推奨。
 */
export interface ToastOptions {
  /** 補足メッセージ（リッチ形式のアクション文言として使用） */
  message?: string;
  /** トーストの種類（旧形式フォールバック用、通常は不要） */
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
const PROGRESS_WIDTH = 400;
const PROGRESS_HEIGHT = 300;
const IDLE_DESTROY_MS = 5 * 60 * 1000;

type OverlayMode = 'toast' | 'progress';

let overlayWindow: BrowserWindow | null = null;
let isWindowReady = false;
let pendingEnsure: Promise<BrowserWindow> | null = null;
let currentMode: OverlayMode | null = null;
let toastHideTimeout: ReturnType<typeof setTimeout> | null = null;

// 非表示のまま放置されたウィンドウを破棄してレンダラープロセスを解放する
const idleDestroyer = new WindowIdleDestroyer(IDLE_DESTROY_MS, () => {
  if (isWindowValid() && !overlayWindow!.isVisible()) {
    destroyOverlayWindow();
  }
});

function isWindowValid(): boolean {
  return overlayWindow !== null && !overlayWindow.isDestroyed();
}

function clearToastHideTimeout(): void {
  if (toastHideTimeout) {
    clearTimeout(toastHideTimeout);
    toastHideTimeout = null;
  }
}

/**
 * マウスカーソルがある画面での表示位置を計算（トースト: 下部中央）
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

/**
 * マウスカーソルがある画面での表示位置を計算（進捗: 中央）
 */
function getProgressPosition(): { x: number; y: number } {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { x: displayX, y: displayY } = display.workArea;
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;

  const x = displayX + Math.round((screenWidth - PROGRESS_WIDTH) / 2);
  const y = displayY + Math.round((screenHeight - PROGRESS_HEIGHT) / 2);

  return { x, y };
}

function createOverlayWindow(): BrowserWindow {
  return new BrowserWindow({
    width: TOAST_WIDTH,
    height: TOAST_HEIGHT,
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
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
}

async function ensureWindow(): Promise<BrowserWindow> {
  if (isWindowValid() && isWindowReady) {
    return overlayWindow!;
  }

  // 同時呼び出し時は進行中のPromiseを再利用
  if (pendingEnsure) {
    return pendingEnsure;
  }

  pendingEnsure = (async () => {
    overlayWindow = createOverlayWindow();
    isWindowReady = false;

    if (EnvConfig.isDevelopment) {
      await overlayWindow.loadURL(`${EnvConfig.devServerUrl}/overlay.html`);
    } else {
      await overlayWindow.loadFile(path.join(__dirname, '../overlay.html'));
    }

    isWindowReady = true;
    pendingEnsure = null;
    return overlayWindow;
  })();

  return pendingEnsure;
}

/**
 * ウィンドウのサイズ・位置を変更する。
 * resizable:false の透過ウィンドウは縮小方向のsetSizeが効かないため、
 * 一時的にリサイズ可能へ切り替えて setBounds で一括適用する。
 */
function applyBounds(
  win: BrowserWindow,
  width: number,
  height: number,
  x: number,
  y: number
): void {
  win.setResizable(true);
  win.setMinimumSize(1, 1);
  win.setBounds({ x, y, width, height });
  win.setResizable(false);
}

/**
 * ウィンドウをトーストモードに構成する（クリック透過・フォーカスなし）
 */
function applyToastMode(win: BrowserWindow): void {
  const { x, y } = getToastPosition();
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setFocusable(false);
  win.setMovable(false);
  applyBounds(win, TOAST_WIDTH, TOAST_HEIGHT, x, y);
  currentMode = 'toast';
}

/**
 * ウィンドウを進捗モードに構成する（操作可能・移動可能）
 */
function applyProgressMode(win: BrowserWindow): void {
  const { x, y } = getProgressPosition();
  win.setIgnoreMouseEvents(false);
  win.setFocusable(true);
  win.setMovable(true);
  applyBounds(win, PROGRESS_WIDTH, PROGRESS_HEIGHT, x, y);
  currentMode = 'progress';
}

/**
 * トースト通知を表示する
 */
export async function showToastWindow(options: ToastOptions): Promise<void> {
  // 進捗表示中はウィンドウを奪わない（トーストは破棄する）
  if (currentMode === 'progress' && isWindowValid() && overlayWindow!.isVisible()) {
    return;
  }

  // グループ起動時は表示時間を長め（3秒）に設定
  const duration = options.duration ?? (options.itemType === 'group' ? 3000 : DEFAULT_DURATION);
  const type = options.type ?? 'success';

  clearToastHideTimeout();
  idleDestroyer.cancel();

  const win = await ensureWindow();

  // トーストメッセージを送信して表示
  win.webContents.send(IPC_CHANNELS.EVENT_SHOW_TOAST, { ...options, type, duration });

  applyToastMode(win);

  // 最前面に表示されるようレベルを明示的に設定してから表示
  win.setAlwaysOnTop(true, 'pop-up-menu');
  if (!win.isVisible()) {
    win.show();
  }

  // 指定時間後に非表示（すぐには破棄せず、アイドルが続いた場合のみ破棄）
  toastHideTimeout = setTimeout(() => {
    toastHideTimeout = null;
    if (!win.isDestroyed() && currentMode === 'toast') {
      win.hide();
      currentMode = null;
      idleDestroyer.schedule();
    }
  }, duration + 500);
}

/**
 * レイアウト進捗ウィンドウを表示する
 */
export async function showLayoutProgressWindow(): Promise<BrowserWindow> {
  // トースト表示中でも進捗を優先してウィンドウを切り替える
  clearToastHideTimeout();
  idleDestroyer.cancel();

  const win = await ensureWindow();

  applyProgressMode(win);
  win.setAlwaysOnTop(true, 'pop-up-menu');

  if (!win.isVisible()) {
    win.show();
  }

  return win;
}

/**
 * レイアウト進捗ウィンドウを非表示にする
 */
export function hideLayoutProgressWindow(): void {
  if (isWindowValid() && currentMode === 'progress') {
    overlayWindow!.hide();
    currentMode = null;
    idleDestroyer.schedule();
  }
}

/**
 * レイアウト進捗イベントの送信先ウィンドウを取得する
 */
export function getLayoutProgressWindow(): BrowserWindow | null {
  return isWindowValid() ? overlayWindow : null;
}

/**
 * オーバーレイウィンドウを完全に破棄する（アプリケーション終了時にも使用）
 */
export function destroyOverlayWindow(): void {
  clearToastHideTimeout();
  idleDestroyer.cancel();
  currentMode = null;
  if (isWindowValid()) {
    overlayWindow!.close();
    overlayWindow = null;
  }
  isWindowReady = false;
}
