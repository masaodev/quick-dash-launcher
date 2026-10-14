import { describe, it, expect } from 'vitest';

import { computePlacementLabel, type ScreenArea } from './placementLabel';

/** 1920×1080 の画面（タスクバー 40 px を除いた作業領域は 1920×1040） */
const screen1: ScreenArea = {
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 },
};
/** 右隣の画面 */
const screen2: ScreenArea = {
  bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
  workArea: { x: 1920, y: 0, width: 1920, height: 1040 },
};

describe('computePlacementLabel', () => {
  it('スナップした左半分は、見えない枠の分ずれていても左半分になる', () => {
    expect(computePlacementLabel({ x: -7, y: 0, width: 974, height: 1047 }, [screen1])).toEqual({
      kind: 'shape',
      shape: 'leftHalf',
    });
  });

  it('右上を判定する', () => {
    expect(computePlacementLabel({ x: 953, y: 0, width: 974, height: 527 }, [screen1])).toEqual({
      kind: 'shape',
      shape: 'topRight',
    });
  });

  it('1/3・2/3 を判定する', () => {
    expect(computePlacementLabel({ x: 0, y: 0, width: 640, height: 1040 }, [screen1])).toEqual({
      kind: 'shape',
      shape: 'leftThird',
    });
    expect(computePlacementLabel({ x: 640, y: 0, width: 1280, height: 1040 }, [screen1])).toEqual({
      kind: 'shape',
      shape: 'rightTwoThirds',
    });
  });

  it('どの形にも当てはまらなければ 9 マスと大きさになる', () => {
    expect(computePlacementLabel({ x: 800, y: 280, width: 320, height: 480 }, [screen1])).toEqual({
      kind: 'region',
      region: 'center',
      width: 320,
      height: 480,
    });
  });

  it('画面が 2 枚以上なら左から番号を付ける', () => {
    expect(
      computePlacementLabel({ x: 1920, y: 0, width: 1920, height: 1040 }, [screen2, screen1])
    ).toEqual({ kind: 'shape', shape: 'full', screenNumber: 2 });
  });

  it('最大化は形より優先する', () => {
    expect(
      computePlacementLabel({ x: 0, y: 0, width: 1920, height: 1040, state: 'maximized' }, [
        screen1,
      ])
    ).toEqual({ kind: 'maximized' });
  });

  it('どの画面にも入らなければ offscreen', () => {
    expect(computePlacementLabel({ x: 4000, y: 0, width: 800, height: 600 }, [screen1])).toEqual({
      kind: 'offscreen',
    });
  });

  it('座標が無ければ none', () => {
    expect(computePlacementLabel({ virtualDesktopNumber: 2 }, [screen1])).toEqual({
      kind: 'none',
    });
  });
});
