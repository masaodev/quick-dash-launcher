import { describe, it, expect } from 'vitest';

import { calculateEditorBounds, EDITOR_WINDOW_SIZE } from './editorWindowBounds';

describe('calculateEditorBounds', () => {
  it('開き元ディスプレイの作業領域の中央に置く（プライマリ以外・負の座標も可）', () => {
    const bounds = calculateEditorBounds({ x: -1920, y: 0, width: 1920, height: 1040 });
    expect(bounds).toEqual({
      x: -1920 + Math.round((1920 - EDITOR_WINDOW_SIZE.width) / 2),
      y: Math.round((1040 - EDITOR_WINDOW_SIZE.height) / 2),
      width: EDITOR_WINDOW_SIZE.width,
      height: EDITOR_WINDOW_SIZE.height,
    });
  });

  it('作業領域より大きくならないよう切り詰める', () => {
    const bounds = calculateEditorBounds({ x: 0, y: 40, width: 800, height: 600 });
    expect(bounds).toEqual({ x: 0, y: 40, width: 800, height: 600 });
  });

  it('作業領域の左上（タスクバー分のオフセット）を考慮する', () => {
    const bounds = calculateEditorBounds({ x: 100, y: 50, width: 1000, height: 900 });
    expect(bounds.x).toBe(100 + 75);
    expect(bounds.y).toBe(50 + 50);
  });
});
