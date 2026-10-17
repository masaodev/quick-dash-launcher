import { describe, it, expect } from 'vitest';

import {
  computeMonitorAnchor,
  isMonitorAnchor,
  placeByMonitorAnchor,
  type Rect,
} from './monitorAnchor';

/** 位置を覚えたモニターから別のモニターへ移したときの bounds */
function move(bounds: Rect, from: Rect, to: Rect): Rect {
  const anchor = computeMonitorAnchor(bounds, from);
  return placeByMonitorAnchor(anchor, { width: bounds.width, height: bounds.height }, to);
}

// 作業領域（タスクバーを除いた範囲）の例
const FHD: Rect = { x: 0, y: 0, width: 1920, height: 1040 };
const WQHD_RIGHT: Rect = { x: 1920, y: 0, width: 2560, height: 1400 };
const FHD_LEFT: Rect = { x: -1920, y: 0, width: 1920, height: 1040 };
const FHD_ABOVE: Rect = { x: 0, y: -1080, width: 1920, height: 1040 };
const PORTRAIT: Rect = { x: 1920, y: -400, width: 1080, height: 1880 };
const SMALL: Rect = { x: 0, y: 0, width: 1280, height: 680 };
// タスクバーを左に置いたモニター（作業領域が右にずれる）
const TASKBAR_LEFT: Rect = { x: 1968, y: 0, width: 1872, height: 1080 };

describe('computeMonitorAnchor', () => {
  it('作業領域の端から 20px 未満なら端を、それ以外は中央を基準にする', () => {
    expect(computeMonitorAnchor({ x: 10, y: 5, width: 300, height: 200 }, FHD)).toEqual({
      horizontal: 'start',
      offsetX: 10,
      vertical: 'start',
      offsetY: 5,
    });
    expect(computeMonitorAnchor({ x: 1610, y: 830, width: 300, height: 200 }, FHD)).toEqual({
      horizontal: 'end',
      offsetX: 10,
      vertical: 'end',
      offsetY: 10,
    });
    expect(computeMonitorAnchor({ x: 960, y: 420, width: 300, height: 200 }, FHD)).toEqual({
      horizontal: 'center',
      offsetX: 150,
      vertical: 'center',
      offsetY: 0,
    });
  });

  it('メイン（幅 600、モニターの中央）のすぐ右に置いたウィンドウは、右寄りでも中央を基準にする', () => {
    const mainRight = 960 + 300;
    const anchor = computeMonitorAnchor(
      { x: mainRight + 10, y: 300, width: 380, height: 400 },
      FHD
    );
    expect(anchor).toEqual({
      horizontal: 'center',
      offsetX: 300 + 10 + 190,
      vertical: 'center',
      offsetY: -20,
    });
  });

  it('プライマリより左・上にあるモニター（座標がマイナス）でも作業領域を基準にする', () => {
    expect(computeMonitorAnchor({ x: 10, y: -1070, width: 300, height: 200 }, FHD_ABOVE)).toEqual({
      horizontal: 'start',
      offsetX: 10,
      vertical: 'start',
      offsetY: 10,
    });
    expect(computeMonitorAnchor({ x: -1910, y: 10, width: 300, height: 200 }, FHD_LEFT)).toEqual({
      horizontal: 'start',
      offsetX: 10,
      vertical: 'start',
      offsetY: 10,
    });
  });
});

describe('placeByMonitorAnchor', () => {
  it('同じモニターに戻すと元の位置になる', () => {
    for (const bounds of [
      { x: 10, y: 20, width: 300, height: 200 },
      { x: 960, y: 420, width: 300, height: 200 },
      { x: 1600, y: 800, width: 300, height: 200 },
    ]) {
      expect(move(bounds, FHD, FHD)).toEqual(bounds);
    }
  });

  it('大きさが同じモニターへは、作業領域の中で同じ位置に移す（左右・上下の並び）', () => {
    const bounds = { x: 1100, y: 300, width: 380, height: 200 };
    expect(move(bounds, FHD, FHD_LEFT)).toEqual({ ...bounds, x: bounds.x - 1920 });
    expect(move(bounds, FHD, FHD_ABOVE)).toEqual({ ...bounds, y: bounds.y - 1080 });
  });

  it('右端に寄せたウィンドウは、大きさの違うモニターでも右端からの距離を保つ', () => {
    const bounds = { x: 1920 - 380, y: 0, width: 380, height: 600 };
    expect(move(bounds, FHD, WQHD_RIGHT)).toEqual({
      x: 1920 + 2560 - 380,
      y: 0,
      width: 380,
      height: 600,
    });
  });

  it('端から離して置いたウィンドウは、大きさの違うモニターでも中央からの距離を保つ（メインとの位置関係が変わらない）', () => {
    // FHD の中央から右へ 400 の位置
    const bounds = { x: 960 + 400 - 190, y: 420, width: 380, height: 200 };
    const placed = move(bounds, FHD, WQHD_RIGHT);
    expect(placed.x + placed.width / 2).toBe(1920 + 1280 + 400);
    expect(placed.y + placed.height / 2).toBe(700);
  });

  it('縦置きのモニターでも、下端からの距離を保つ', () => {
    const bounds = { x: 5, y: 1040 - 200 - 10, width: 380, height: 200 };
    expect(move(bounds, FHD, PORTRAIT)).toEqual({
      x: 1920 + 5,
      y: -400 + 1880 - 10 - 200,
      width: 380,
      height: 200,
    });
  });

  it('タスクバーで作業領域がずれたモニターでも、作業領域の端を基準にする', () => {
    const bounds = { x: 0, y: 0, width: 380, height: 200 };
    expect(move(bounds, FHD, TASKBAR_LEFT)).toEqual({ x: 1968, y: 0, width: 380, height: 200 });
  });

  it('小さいモニターではみ出す分は、作業領域の中へ寄せる', () => {
    // 中央から右へ 900（FHD では収まるが、幅 1280 では右にはみ出す）
    const bounds = { x: 960 + 900 - 50, y: 500, width: 100, height: 100 };
    expect(computeMonitorAnchor(bounds, FHD).horizontal).toBe('end');
    // 右端からの距離 10 を保つ
    expect(move(bounds, FHD, SMALL).x).toBe(1280 - 10 - 100);

    const centered = placeByMonitorAnchor(
      { horizontal: 'center', offsetX: 900, vertical: 'start', offsetY: 0 },
      { width: 100, height: 100 },
      SMALL
    );
    expect(centered.x).toBe(1280 - 100);
  });

  it('作業領域より大きいウィンドウは、作業領域の大きさまで縮めて収める', () => {
    const placed = placeByMonitorAnchor(
      { horizontal: 'end', offsetX: 0, vertical: 'start', offsetY: 0 },
      { width: 2000, height: 1300 },
      SMALL
    );
    expect(placed).toEqual({ x: 0, y: 0, width: 1280, height: 680 });
  });

  it('座標は整数にする', () => {
    const placed = placeByMonitorAnchor(
      { horizontal: 'center', offsetX: 0.4, vertical: 'center', offsetY: 0 },
      { width: 301, height: 201 },
      FHD
    );
    expect(Number.isInteger(placed.x)).toBe(true);
    expect(Number.isInteger(placed.y)).toBe(true);
  });
});

describe('isMonitorAnchor', () => {
  it('形の合う値だけ受け付ける', () => {
    expect(
      isMonitorAnchor({ horizontal: 'end', offsetX: 1, vertical: 'center', offsetY: -2 })
    ).toBe(true);
    expect(
      isMonitorAnchor({ horizontal: 'left', offsetX: 1, vertical: 'center', offsetY: 0 })
    ).toBe(false);
    expect(isMonitorAnchor({ horizontal: 'end', offsetX: '1', vertical: 'end', offsetY: 0 })).toBe(
      false
    );
    expect(isMonitorAnchor({ horizontal: 'end', offsetX: NaN, vertical: 'end', offsetY: 0 })).toBe(
      false
    );
    expect(isMonitorAnchor(null)).toBe(false);
  });
});
