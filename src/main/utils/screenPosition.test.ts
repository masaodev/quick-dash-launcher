import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrowserWindow } from 'electron';

import { moveWindowKeepingSize } from './screenPosition';

// 拡大率 150% の画面を、DIP×1.5＝物理ピクセルとしてまねる。見えない枠は左上に 9px
const SCALE = 1.5;
const FRAME = 9;

const native = vi.hoisted(() => ({
  /** 物理ピクセルでの GetWindowRect（見えない枠を含む） */
  rect: { x: 0, y: 0, width: 0, height: 0 },
  getWindowBounds: vi.fn(),
  setWindowBounds: vi.fn(),
}));

vi.mock('electron', () => ({
  screen: {
    dipToScreenRect: (
      _win: unknown,
      r: { x: number; y: number; width: number; height: number }
    ) => ({
      x: r.x * 1.5,
      y: r.y * 1.5,
      width: r.width * 1.5,
      height: r.height * 1.5,
    }),
    dipToScreenPoint: (p: { x: number; y: number }) => ({ x: p.x * 1.5, y: p.y * 1.5 }),
  },
}));
vi.mock('./nativeWindowControl.js', () => ({
  getWindowBounds: native.getWindowBounds,
  setWindowBounds: native.setWindowBounds,
}));

/** 物理ピクセルの位置から DIP の getBounds を返すウィンドウ（大きさは物理ピクセルのまま変わらない） */
function makeWindow(): BrowserWindow {
  return {
    getNativeWindowHandle: () => {
      const buf = Buffer.alloc(8);
      buf.writeBigUInt64LE(42n);
      return buf;
    },
    getBounds: () => ({
      x: Math.round((native.rect.x + FRAME) / SCALE),
      y: Math.round((native.rect.y + FRAME) / SCALE),
      width: 406,
      height: 303,
    }),
    setPosition: vi.fn(),
  } as unknown as BrowserWindow;
}

describe('moveWindowKeepingSize', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    native.rect = { x: -1350 - FRAME, y: 300 - FRAME, width: 628, height: 465 };
    native.getWindowBounds.mockImplementation(() => ({ ...native.rect }));
    native.setWindowBounds.mockImplementation((_hwnd: bigint, c: { x: number; y: number }) => {
      native.rect = { ...native.rect, x: c.x, y: c.y };
      return true;
    });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    vi.clearAllMocks();
  });

  it('物理ピクセルで位置だけを動かし、大きさは渡さない（見えない枠の分をずらす）', () => {
    const win = makeWindow();
    moveWindowKeepingSize(win, -880, 200);

    expect(native.setWindowBounds).toHaveBeenCalledTimes(1);
    expect(native.setWindowBounds).toHaveBeenCalledWith(42n, { x: -1320 - FRAME, y: 300 - FRAME });
    expect(win.getBounds()).toMatchObject({ x: -880, y: 200 });
    expect(win.setPosition).not.toHaveBeenCalled();
  });

  it('動かした後の位置がずれていれば（拡大率の違う画面へ移したとき）もう一度合わせる', () => {
    const win = makeWindow();
    // 1 回目は移った先で見えない枠の幅が変わり、2px 外れたことにする
    native.setWindowBounds.mockImplementationOnce((_hwnd: bigint, c: { x: number; y: number }) => {
      native.rect = { ...native.rect, x: c.x + 3, y: c.y };
      return true;
    });
    moveWindowKeepingSize(win, -880, 200);

    expect(native.setWindowBounds).toHaveBeenCalledTimes(2);
    expect(win.getBounds()).toMatchObject({ x: -880, y: 200 });
  });

  it('Win32 で動かせないとき・Windows 以外では setPosition に任せる', () => {
    const win = makeWindow();
    native.getWindowBounds.mockReturnValueOnce(null);
    moveWindowKeepingSize(win, -880, 200);
    expect(win.setPosition).toHaveBeenCalledWith(-880, 200);

    Object.defineProperty(process, 'platform', { value: 'darwin' });
    moveWindowKeepingSize(win, 10, 20);
    expect(win.setPosition).toHaveBeenCalledWith(10, 20);
    expect(native.setWindowBounds).not.toHaveBeenCalled();
  });
});
