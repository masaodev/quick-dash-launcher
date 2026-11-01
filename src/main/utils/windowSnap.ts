import { BrowserWindow, screen } from 'electron';
import { windowLogger } from '@common/logger';

import { moveWindowKeepingSize } from './screenPosition.js';
import { computeSnappedPosition, type Rect } from './snapPosition.js';
import {
  getCurrentDesktopNumber,
  getHwnd,
  isPinnedWindow,
  isWindowOnDesktopNumber,
} from './virtualDesktop/index.js';

const WM_EXITSIZEMOVE = 0x0232;

/**
 * 吸着先になるウィンドウ（メイン・ワークスペース・切り離しウィンドウ）。
 * 吸着するウィンドウは attachSnapHandler で、吸着先になるだけのウィンドウ（メイン）は registerSnapTarget で入る
 */
const snapTargets = new Set<BrowserWindow>();

/**
 * ほかのウィンドウの吸着先にする（自分は動かしても吸着しない）。閉じたら外れる
 */
export function registerSnapTarget(win: BrowserWindow): void {
  if (snapTargets.has(win)) return;
  snapTargets.add(win);
  win.once('closed', () => snapTargets.delete(win));
}

/**
 * 今の仮想デスクトップに見えているか（ほかの仮想デスクトップのウィンドウも isVisible は true を返す）。
 * すべての仮想デスクトップに表示（固定）しているものは見えている。仮想デスクトップを調べられないときは見えているとする
 */
function isOnCurrentDesktop(win: BrowserWindow): boolean {
  const current = getCurrentDesktopNumber();
  if (current < 1) return true;
  try {
    const hwnd = getHwnd(win);
    return isPinnedWindow(hwnd) || isWindowOnDesktopNumber(hwnd, current);
  } catch {
    return true;
  }
}

/** 動かしたウィンドウの吸着先にする、今の仮想デスクトップに表示中のほかのウィンドウの位置と大きさ */
export function getTargetRects(self: BrowserWindow): Rect[] {
  const rects: Rect[] = [];
  for (const target of snapTargets) {
    if (target === self || target.isDestroyed()) continue;
    if (!target.isVisible() || target.isMinimized()) continue;
    if (!isOnCurrentDesktop(target)) continue;
    rects.push(target.getBounds());
  }
  return rects;
}

/**
 * BrowserWindowにスナップハンドラーを登録する
 *
 * 動かし終えたとき、ディスプレイの端と、表示中のほかのウィンドウ（registerSnapTarget・attachSnapHandler で
 * 入ったもの）へ吸着させる。このウィンドウもほかのウィンドウの吸着先になる
 * @param win 対象のBrowserWindow
 * @param getEnabled 吸着が有効かどうかを返すコールバック（同期的、キャッシュ値を使用）
 * @returns ハンドラー解除関数
 */
export function attachSnapHandler(win: BrowserWindow, getEnabled: () => boolean): () => void {
  registerSnapTarget(win);

  win.hookWindowMessage(WM_EXITSIZEMOVE, () => {
    if (!getEnabled() || win.isDestroyed()) return;

    const bounds = win.getBounds();
    const workAreas = screen.getAllDisplays().map((display) => display.workArea);
    const { x, y, snapped } = computeSnappedPosition(bounds, workAreas, getTargetRects(win));
    if (snapped) {
      moveWindowKeepingSize(win, x, y);
    }
  });

  windowLogger.info('ウィンドウスナップハンドラーを登録しました');

  return () => {
    if (!win.isDestroyed()) {
      win.unhookWindowMessage(WM_EXITSIZEMOVE);
    }
  };
}
