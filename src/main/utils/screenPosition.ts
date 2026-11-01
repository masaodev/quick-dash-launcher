import { screen } from 'electron';
import type { BrowserWindow, Rectangle } from 'electron';

import { getWindowBounds, setWindowBounds } from './nativeWindowControl.js';

/** 指定座標がいずれかのディスプレイの作業領域内にあるか（モニターを外した後の保存位置の確認に使う） */
export function isPositionOnScreen(x: number, y: number): boolean {
  return screen.getAllDisplays().some((display) => {
    const wb = display.workArea;
    return x >= wb.x && x < wb.x + wb.width && y >= wb.y && y < wb.y + wb.height;
  });
}

/**
 * 位置とサイズを当てる。拡大率の違うモニターへ移すと 1 回ではサイズがずれることがあるので、ずれていればもう一度当てる
 */
export function setBoundsAcrossDisplays(win: BrowserWindow, bounds: Rectangle): void {
  win.setBounds(bounds);
  const applied = win.getBounds();
  if (applied.width !== bounds.width || applied.height !== bounds.height) {
    win.setBounds(bounds);
  }
}

/**
 * 大きさを変えずに、左上を DIP の (x, y) へ動かす（物理ピクセルで SetWindowPos に SWP_NOSIZE を付けて）。
 * GetWindowRect には見えない枠が入り、Electron の位置には入らないので、今の差を足す
 * @returns 動かせたら true
 */
function moveByPhysicalPixels(win: BrowserWindow, x: number, y: number): boolean {
  const hwnd = win.getNativeWindowHandle().readBigUInt64LE();
  const frame = getWindowBounds(hwnd);
  if (!frame) return false;
  const current = screen.dipToScreenRect(win, win.getBounds());
  const target = screen.dipToScreenPoint({ x, y });
  return setWindowBounds(hwnd, {
    x: Math.round(target.x) + frame.x - current.x,
    y: Math.round(target.y) + frame.y - current.y,
  });
}

/**
 * 大きさを変えずに位置だけ動かす（吸着・保存した位置へ戻すときなど）
 *
 * Electron の setPosition は、拡大率が 100% でない画面では動かすたびに大きさが数 px ずつ増える
 * （DIP の丸めのため。2026-11 に 150% の画面で確かめた）。物理ピクセルで位置だけを動かして避ける。
 * 拡大率の違う画面へ移すと大きさは Windows が拡大率の比で直し、見えない枠の幅も変わるので、
 * 移った先でもう一度位置を合わせる
 */
export function moveWindowKeepingSize(win: BrowserWindow, x: number, y: number): void {
  if (process.platform !== 'win32' || !moveByPhysicalPixels(win, x, y)) {
    win.setPosition(x, y);
    return;
  }
  const moved = win.getBounds();
  if (moved.x !== x || moved.y !== y) {
    moveByPhysicalPixels(win, x, y);
  }
}
