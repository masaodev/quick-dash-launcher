/**
 * オーバーレイウィンドウサービス（トースト＋レイアウト進捗の共用）
 *
 * どちらも小型の透過・最前面ウィンドウであるため、1枚のウィンドウを
 * モードに応じてサイズ・位置・操作可否を切り替えて使い回す。
 * ウィンドウはメインウィンドウのレンダラープロセスを共有する（childWindowService）。
 *
 * 表示ポリシー: レイアウト進捗の表示中はトーストを表示しない（進捗の方が
 * 情報量が多く、レイアウト実行は数秒〜数十秒で終わるため）。
 *
 * @see docs/features/toast-notifications.md
 */

import { BrowserWindow, screen } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import type { ToastItemType, ToastOptions } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { windowLogger } from '@common/logger';

import { WindowIdleDestroyer } from '../utils/windowIdleDestroyer.js';
import { DEFAULT_WEB_PREFERENCES } from '../utils/managedWindow.js';

import { mainI18n } from './mainI18n.js';
import { getRendererHtmlUrl, openChildWindow } from './childWindowService.js';

/**
 * 種別ごとの既定の文言のキー（message が無いときに出す）。
 * デスクトップ移動・ブックマーク取込は message を必ず渡す種別なので、無ければ空にする
 */
const NO_DEFAULT_ACTION: ReadonlySet<string> = new Set(['windowMoveDesktop', 'bookmarkImport']);

const ACTION_KEYS = {
  url: 'toast.actions.url',
  app: 'toast.actions.app',
  file: 'toast.actions.file',
  folder: 'toast.actions.folder',
  customUri: 'toast.actions.customUri',
  windowSwitch: 'toast.actions.windowSwitch',
  windowActivate: 'toast.actions.windowActivate',
  windowClose: 'toast.actions.windowClose',
  windowPin: 'toast.actions.windowPin',
  windowUnpin: 'toast.actions.windowUnpin',
  workspaceAdd: 'toast.actions.workspaceAdd',
  clipboard: 'toast.actions.clipboard',
} as const satisfies Partial<Record<ToastItemType, string>>;

/** overlay.html に渡す、表示言語に合わせた文言 */
interface ToastText {
  /** 区切り線の下の 1 行（セットは「N件のアイテムを起動します」） */
  action: string;
  /** セットの中身（先頭の 3 件。残りは「… 他 N 件」） */
  groupItems?: string;
}

function buildToastText(options: ToastOptions): ToastText {
  const t = mainI18n.t.bind(mainI18n);
  if (options.itemType === 'set') {
    const names = options.itemNames ?? [];
    const count = options.itemCount || names.length;
    const shown = names.slice(0, 3).join(t('common.listSeparator'));
    const remaining = count - 3;
    return {
      action: t('toast.groupOpening', { count }),
      groupItems:
        names.length === 0
          ? t('toast.groupOpening', { count })
          : remaining > 0
            ? t('toast.groupMore', { names: shown, count: remaining })
            : shown,
    };
  }
  if (options.message) return { action: options.message };
  if (!options.itemType || NO_DEFAULT_ACTION.has(options.itemType)) return { action: '' };
  const key = ACTION_KEYS[options.itemType as keyof typeof ACTION_KEYS];
  return { action: key ? t(key) : t('toast.actions.default') };
}

const TOAST_WIDTH = 400;
const TOAST_HEIGHT = 100;
const TOAST_MARGIN = 16;
const DEFAULT_DURATION = 2500;
const GROUP_DURATION = 3000;
/** 警告など、読み終えるまで少し長く出しておくトーストの表示時間 */
export const LONG_TOAST_DURATION_MS = 6000;
const PROGRESS_WIDTH = 400;
/** 進み具合の行 1 つ分の高さの目安（名前と、その下の exe 名の 2 段） */
const PROGRESS_ROW_HEIGHT = 46;
/** 進み具合の行以外の高さ（見出し・細い進捗バー・一覧の余白・足元） */
const PROGRESS_FRAME_HEIGHT = 96;
/** 進み具合で、スクロールせずに見せる行の数の上限 */
const PROGRESS_MAX_ROWS = 8;
const PROGRESS_MIN_HEIGHT = PROGRESS_FRAME_HEIGHT + PROGRESS_ROW_HEIGHT;
const PROGRESS_MAX_HEIGHT = PROGRESS_FRAME_HEIGHT + PROGRESS_ROW_HEIGHT * PROGRESS_MAX_ROWS;
const IDLE_DESTROY_MS = 5 * 60 * 1000;

type OverlayMode = 'toast' | 'progress';

let overlayWindow: BrowserWindow | null = null;
let isWindowReady = false;
let pendingEnsure: Promise<BrowserWindow> | null = null;
let currentMode: OverlayMode | null = null;
/** 進み具合の表示が終わった（失敗・中止で「閉じる」を待っている）か。終わった表示はトーストに場所を譲る */
let progressFinished = false;
let toastHideTimeout: ReturnType<typeof setTimeout> | null = null;

// 非表示のまま放置されたウィンドウを破棄して DOM・描画面のメモリを解放する
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

/** 行の数から、進み具合の表示の高さを見積もる（表示が中身を測って直すまでの高さ） */
export function estimateProgressHeight(entryCount: number): number {
  const rows = Math.min(Math.max(entryCount, 1), PROGRESS_MAX_ROWS);
  return PROGRESS_FRAME_HEIGHT + PROGRESS_ROW_HEIGHT * rows;
}

/**
 * マウスカーソルがある画面での表示位置を計算（進捗: 中央）
 */
function getProgressPosition(height: number): { x: number; y: number } {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { x: displayX, y: displayY } = display.workArea;
  const { width: screenWidth, height: screenHeight } = display.workAreaSize;

  const x = displayX + Math.round((screenWidth - PROGRESS_WIDTH) / 2);
  const y = displayY + Math.round((screenHeight - height) / 2);

  return { x, y };
}

const OVERLAY_WINDOW_OPTIONS: BrowserWindowConstructorOptions = {
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
  webPreferences: DEFAULT_WEB_PREFERENCES,
};

/**
 * オーバーレイウィンドウを生成する
 * メインウィンドウのレンダラーから window.open で開き、レンダラープロセスを共有する
 * （トースト表示のたびに別プロセスが立つのを避け、初回表示も速くなる）
 * 開き元が使えない場合はメインプロセスで直接生成する
 */
async function createOverlayWindow(): Promise<BrowserWindow> {
  const shared = await openChildWindow('main', {
    name: 'overlay',
    html: 'overlay.html',
    options: OVERLAY_WINDOW_OPTIONS,
  });
  if (shared) {
    return shared;
  }
  windowLogger.warn('レンダラー共有での生成に失敗したためオーバーレイウィンドウを直接生成します');
  const win = new BrowserWindow(OVERLAY_WINDOW_OPTIONS);
  await win.loadURL(getRendererHtmlUrl('overlay.html'));
  return win;
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
    isWindowReady = false;
    try {
      overlayWindow = await createOverlayWindow();
      isWindowReady = true;
      return overlayWindow;
    } finally {
      pendingEnsure = null;
    }
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
  // 表示中のウィンドウに setFocusable(false) を呼ぶと、Electron が Z 順で次のウィンドウ（最前面の
  // トーストの下はタスクバー）を前面に出し、メインウィンドウがフォーカスを失って隠れる。
  // トーストを続けて出すと毎回これが起きるので、フォーカスを受け取れる状態のときだけ切り替える
  if (win.isFocusable()) {
    win.setFocusable(false);
  }
  win.setMovable(false);
  applyBounds(win, TOAST_WIDTH, TOAST_HEIGHT, x, y);
  currentMode = 'toast';
}

/**
 * ウィンドウを進捗モードに構成する（操作可能・移動可能）
 */
function applyProgressMode(win: BrowserWindow, height: number): void {
  const { x, y } = getProgressPosition(height);
  win.setIgnoreMouseEvents(false);
  win.setFocusable(true);
  win.setMovable(true);
  applyBounds(win, PROGRESS_WIDTH, height, x, y);
  currentMode = 'progress';
  progressFinished = false;
}

/** 進み具合の表示が終わったことを覚える（このあとのトーストは表示を置き換えてよい） */
export function markLayoutProgressFinished(): void {
  progressFinished = true;
}

/**
 * トースト通知を表示する
 */
export async function showToastWindow(options: ToastOptions): Promise<void> {
  // 進捗表示中はウィンドウを奪わない（トーストは破棄する）。終わった表示はトーストに置き換える
  if (
    currentMode === 'progress' &&
    !progressFinished &&
    isWindowValid() &&
    overlayWindow!.isVisible()
  ) {
    return;
  }

  // セットの起動時は表示時間を長め（3秒）に設定
  const duration =
    options.duration ?? (options.itemType === 'set' ? GROUP_DURATION : DEFAULT_DURATION);
  const type = options.type ?? 'success';

  clearToastHideTimeout();
  idleDestroyer.cancel();

  const win = await ensureWindow();

  // トーストメッセージを送信して表示
  win.webContents.send(IPC_CHANNELS.EVENT_SHOW_TOAST, {
    ...options,
    type,
    duration,
    text: buildToastText(options),
  });

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
 *
 * @param entryCount 行の数（最初の高さの見積もりに使う。表示が中身を測って resizeLayoutProgressWindow で直す）
 */
export async function showLayoutProgressWindow(entryCount = 1): Promise<BrowserWindow> {
  // トースト表示中でも進捗を優先してウィンドウを切り替える
  clearToastHideTimeout();
  idleDestroyer.cancel();

  const win = await ensureWindow();

  applyProgressMode(win, estimateProgressHeight(entryCount));
  win.setAlwaysOnTop(true, 'pop-up-menu');

  if (!win.isVisible()) {
    win.show();
  }

  return win;
}

/**
 * 進み具合の表示の高さを中身に合わせる（表示が測った高さ。上限を超える分は一覧をスクロールさせる）
 *
 * 上下の真ん中を動かさずに伸び縮みさせる（画面の中央に出しているため。利用者が動かした後もその位置で）
 */
export function resizeLayoutProgressWindow(contentHeight: number): void {
  if (!isWindowValid() || currentMode !== 'progress' || !Number.isFinite(contentHeight)) return;
  const height = Math.min(
    Math.max(Math.ceil(contentHeight), PROGRESS_MIN_HEIGHT),
    PROGRESS_MAX_HEIGHT
  );
  const bounds = overlayWindow!.getBounds();
  if (bounds.height === height) return;
  const y = bounds.y + Math.round((bounds.height - height) / 2);
  applyBounds(overlayWindow!, bounds.width, height, bounds.x, y);
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
 * オーバーレイウィンドウ（トースト・進捗）を取得する。ウィンドウ検索の一覧から外すのに使う
 */
export function getOverlayWindow(): BrowserWindow | null {
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
