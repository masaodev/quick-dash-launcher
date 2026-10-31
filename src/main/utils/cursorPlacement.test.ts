import { describe, expect, it } from 'vitest';

import { placeNearCursor } from './cursorPlacement';

const primary = { x: 0, y: 0, width: 1920, height: 1040 };
const left = { x: -1920, y: 0, width: 1920, height: 1040 };

describe('placeNearCursor', () => {
  it('カーソルが横の真ん中・上から 4 分の 1 に来るように置く', () => {
    expect(placeNearCursor(960, 500, 400, 600, primary)).toEqual({ x: 760, y: 350 });
  });

  it('左にあるディスプレイ（座標が負）では、そのディスプレイの中に置く（0 に切り上げない）', () => {
    expect(placeNearCursor(-1000, 500, 400, 600, left)).toEqual({ x: -1200, y: 350 });
    // 左端の近くでは作業領域の左端にそろえる
    expect(placeNearCursor(-1900, 500, 400, 600, left)).toEqual({ x: -1920, y: 350 });
  });

  it('右下の端で離しても、作業領域からはみ出さない', () => {
    expect(placeNearCursor(1910, 1030, 400, 600, primary)).toEqual({ x: 1520, y: 440 });
  });

  it('作業領域より大きいウィンドウは左上をそろえる', () => {
    expect(placeNearCursor(100, 100, 2400, 1200, primary)).toEqual({ x: 0, y: 0 });
  });
});
