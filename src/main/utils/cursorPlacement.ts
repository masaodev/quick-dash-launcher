import type { Rectangle } from 'electron';

/**
 * カーソル（ドロップした位置・メニューを選んだ位置）の近くに置くときの左上を、そのディスプレイの作業領域に収めて求める
 *
 * カーソルが横の真ん中・上から 4 分の 1 に来る位置を基準にし、作業領域からはみ出す分だけ内側へ寄せる。
 * 左や上にあるディスプレイは座標が負になるので、0 で切り上げてはいけない（メインのディスプレイへ飛ぶ）。
 * 作業領域より大きいウィンドウは左上をそろえる
 */
export function placeNearCursor(
  cursorX: number,
  cursorY: number,
  width: number,
  height: number,
  workArea: Rectangle
): { x: number; y: number } {
  const clamp = (value: number, min: number, size: number, areaSize: number) =>
    Math.round(Math.max(min, Math.min(value, min + areaSize - size)));
  return {
    x: clamp(cursorX - width / 2, workArea.x, width, workArea.width),
    y: clamp(cursorY - height / 4, workArea.y, height, workArea.height),
  };
}
