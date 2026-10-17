import { describe, it, expect } from 'vitest';

import type { ScreenArea } from './placementLabel';
import { computeMinimapLayout } from './placementMap';

const area = (x: number, y: number, width: number, height: number, taskbar = 48): ScreenArea => ({
  bounds: { x, y, width, height },
  workArea: { x, y, width, height: height - taskbar },
});

/** 左にノートの画面、中央がメイン、右にもう 1 枚（上端をそろえて横に並べる） */
const left = area(-1920, 0, 1920, 1080);
const main = area(0, 0, 2560, 1440);
const right = area(2560, 0, 2560, 1440);

describe('computeMinimapLayout', () => {
  it('画面が無ければ null（図を出さない）', () => {
    expect(computeMinimapLayout([], [], 100, 50)).toBeNull();
  });

  it('画面を左から番号を振り、実物の大きさの比のまま縮める', () => {
    const layout = computeMinimapLayout([right, left, main], [], 1000, 1000, 0)!;
    expect(layout.screens.map((s) => s.number)).toEqual([1, 2, 3]);
    const [l, m, r] = layout.screens;
    // 全体の幅 7040px を 1000 に縮める
    expect(l.width).toBeCloseTo((1920 / 7040) * 1000);
    expect(m.width).toBeCloseTo((2560 / 7040) * 1000);
    expect(m.height / l.height).toBeCloseTo(1440 / 1080);
    // 横に並び、隙間も重なりも無い
    expect(l.x + l.width).toBeCloseTo(m.x);
    expect(m.x + m.width).toBeCloseTo(r.x);
    // 上端がそろう
    expect(l.y).toBeCloseTo(m.y);
  });

  it('上下に並べた画面は、上下のまま描く', () => {
    const top = area(320, -1080, 1920, 1080);
    const layout = computeMinimapLayout([main, top], [], 200, 200, 0)!;
    const [bottom, upper] = layout.screens; // 左端が小さい main が 1
    expect(upper.y + upper.height).toBeCloseTo(bottom.y);
    expect(upper.x).toBeGreaterThan(bottom.x);
  });

  it('作業領域の外（タスクバー）を返す', () => {
    const layout = computeMinimapLayout([main], [], 256, 144, 0)!;
    expect(layout.screens[0].outside).toHaveLength(1);
    expect(layout.screens[0].outside[0].height).toBeCloseTo(4.8);
  });

  it('ウィンドウが乗っている画面に印を付ける', () => {
    const layout = computeMinimapLayout(
      [left, main, right],
      [{ placement: { x: 100, y: 100, width: 800, height: 600 } }],
      700,
      200
    )!;
    expect(layout.screens.map((s) => s.active)).toEqual([false, true, false]);
    expect(layout.windows[0]).toMatchObject({ variant: 'current', offscreen: false, index: 0 });
  });

  it('前の位置（before）では画面に印を付けない', () => {
    const layout = computeMinimapLayout(
      [left, main],
      [{ placement: { x: -1800, y: 100, width: 800, height: 600 }, variant: 'before' }],
      400,
      200
    )!;
    expect(layout.screens.every((s) => !s.active)).toBe(true);
  });

  it('最大化は、乗っている画面の作業領域いっぱいに描く', () => {
    const layout = computeMinimapLayout(
      [main],
      [{ placement: { x: -8, y: -8, width: 2576, height: 1408, state: 'maximized' } }],
      256,
      144,
      0
    )!;
    const [w] = layout.windows;
    const [s] = layout.screens;
    expect(w.x).toBeCloseTo(s.x);
    expect(w.width).toBeCloseTo(s.width);
    expect(w.height).toBeCloseTo((1392 / 1440) * s.height);
  });

  it('今は無い画面の位置は、画面の外に描き、全体がその分広がる', () => {
    const layout = computeMinimapLayout(
      [main],
      [{ placement: { x: 3000, y: 0, width: 1000, height: 1000 } }],
      400,
      100,
      0
    )!;
    const [w] = layout.windows;
    expect(w.offscreen).toBe(true);
    expect(w.x).toBeGreaterThan(layout.screens[0].x + layout.screens[0].width);
    expect(w.x + w.width).toBeLessThanOrEqual(400.0001);
  });

  it('座標の無い位置は描かず、添字と印はそのまま残す', () => {
    const layout = computeMinimapLayout(
      [main],
      [
        { placement: {}, tag: '1' },
        { placement: { x: 0, y: 0, width: 100, height: 100 }, tag: '2' },
      ],
      256,
      144
    )!;
    expect(layout.windows).toHaveLength(1);
    expect(layout.windows[0]).toMatchObject({ index: 1, tag: '2' });
  });

  it('fit なら、図の大きさを中身の縦横比に合わせて縮める', () => {
    const layout = computeMinimapLayout([left, main, right], [], 704, 300, 0, true)!;
    expect(layout.width).toBe(704);
    expect(layout.height).toBe(144);
    expect(layout.screens[1].y).toBeCloseTo(0);
  });
});
