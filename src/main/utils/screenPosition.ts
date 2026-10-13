import { screen } from 'electron';

/** 指定座標がいずれかのディスプレイの作業領域内にあるか（モニターを外した後の保存位置の確認に使う） */
export function isPositionOnScreen(x: number, y: number): boolean {
  return screen.getAllDisplays().some((display) => {
    const wb = display.workArea;
    return x >= wb.x && x < wb.x + wb.width && y >= wb.y && y < wb.y + wb.height;
  });
}
