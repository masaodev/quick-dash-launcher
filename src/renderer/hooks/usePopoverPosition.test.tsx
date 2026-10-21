import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { usePopoverPosition } from './usePopoverPosition';

/** 指定の大きさに見えるメニューの要素 */
function popoverOf(width: number, height: number) {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ width, height }) as DOMRect;
  return { current: el };
}

/** ref は描くたびに作り直さない（コンポーネントの useRef と同じく 1 つを使い回す） */
function renderPopover(ref: { current: HTMLElement }, position: { x: number; y: number }) {
  return renderHook(() => usePopoverPosition(ref, position));
}

describe('usePopoverPosition', () => {
  const original = { width: window.innerWidth, height: window.innerHeight };

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: original.width, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: original.height, configurable: true });
  });

  it('収まるならそのままの位置に出す', () => {
    const { result } = renderPopover(popoverOf(200, 100), { x: 50, y: 60 });
    expect(result.current).toEqual({ left: 50, top: 60 });
  });

  it('右・下にはみ出すなら、画面の端から 8px 内側までずらす', () => {
    const { result } = renderPopover(popoverOf(300, 200), { x: 900, y: 500 });
    expect(result.current).toEqual({ left: 1000 - 300 - 8, top: 600 - 200 - 8 });
  });

  it('画面より大きいメニューは左上の端に合わせる', () => {
    const { result } = renderPopover(popoverOf(1200, 800), { x: 300, y: 300 });
    expect(result.current).toEqual({ left: 8, top: 8 });
  });
});
