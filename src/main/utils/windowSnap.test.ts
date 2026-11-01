import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow } from 'electron';

import { getTargetRects, registerSnapTarget } from './windowSnap';

// vi.mock は import より先に当たる

const desktop = vi.hoisted(() => ({
  current: 1,
  /** hwnd → 置いてある仮想デスクトップ（0＝すべての仮想デスクトップに表示） */
  placement: new Map<bigint, number>(),
}));

vi.mock('electron', () => ({ BrowserWindow: class {}, screen: {} }));
vi.mock('@common/logger', () => ({ windowLogger: { info: vi.fn() } }));
vi.mock('./virtualDesktop/index.js', () => ({
  getCurrentDesktopNumber: () => desktop.current,
  getHwnd: (win: { hwnd: bigint }) => win.hwnd,
  isPinnedWindow: (hwnd: bigint) => desktop.placement.get(hwnd) === 0,
  isWindowOnDesktopNumber: (hwnd: bigint, n: number) => desktop.placement.get(hwnd) === n,
}));

let nextHwnd = 1n;
function makeWindow(x: number, desktopNumber: number): BrowserWindow {
  const hwnd = nextHwnd++;
  desktop.placement.set(hwnd, desktopNumber);
  return {
    hwnd,
    isDestroyed: () => false,
    isVisible: () => true,
    isMinimized: () => false,
    getBounds: () => ({ x, y: 0, width: 100, height: 100 }),
    once: vi.fn(),
  } as unknown as BrowserWindow;
}

describe('getTargetRects', () => {
  beforeEach(() => {
    desktop.current = 1;
  });

  it('ほかの仮想デスクトップのウィンドウには吸着しない（すべての仮想デスクトップに表示しているものには吸着する）', () => {
    const self = makeWindow(0, 1);
    const sameDesktop = makeWindow(200, 1);
    const otherDesktop = makeWindow(400, 2);
    const pinned = makeWindow(600, 0);
    for (const win of [self, sameDesktop, otherDesktop, pinned]) registerSnapTarget(win);

    expect(getTargetRects(self).map((r) => r.x)).toEqual([200, 600]);

    // 仮想デスクトップを調べられないとき（DLL が無い）は、今までどおり表示中のものすべてに吸着する
    desktop.current = -1;
    expect(getTargetRects(self).map((r) => r.x)).toEqual([200, 400, 600]);
  });
});
