import { screen } from 'electron';
import type { BrowserWindow, Rectangle } from 'electron';

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
