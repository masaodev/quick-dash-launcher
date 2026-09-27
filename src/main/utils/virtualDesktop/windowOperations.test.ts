/**
 * 仮想デスクトップのウィンドウ操作のテスト
 *
 * DLL とレジストリはモックする（実際のウィンドウは動かさない）。
 * 実機での移動確認は手動テストスクリプト `npm run test:window-move` で行う。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dll = vi.hoisted(() => ({
  moveWindowToDesktopNumber: vi.fn(),
  getDesktopCount: vi.fn(),
}));
const registry = vi.hoisted(() => ({
  isVirtualDesktopSupported: vi.fn(),
  getVirtualDesktopGUIDs: vi.fn(),
}));

vi.mock('./dllLoader.js', () => ({
  getMoveWindowToDesktopNumber: () => dll.moveWindowToDesktopNumber,
  getGetDesktopCount: () => dll.getDesktopCount,
  getGetCurrentDesktopNumber: () => null,
  getIsWindowOnDesktopNumber: () => null,
  getGetWindowDesktopNumber: () => null,
  getPinWindow: () => null,
  getUnPinWindow: () => null,
  getIsPinnedWindow: () => null,
  getGetDesktopName: () => null,
}));
vi.mock('./registryAccess.js', () => registry);

import { getDesktopCount, moveWindowToVirtualDesktop } from './windowOperations.js';

describe('windowOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    registry.isVirtualDesktopSupported.mockReturnValue(true);
    registry.getVirtualDesktopGUIDs.mockReturnValue([]);
    dll.getDesktopCount.mockReturnValue(3);
    dll.moveWindowToDesktopNumber.mockReturnValue(1);
  });

  describe('moveWindowToVirtualDesktop', () => {
    it('デスクトップ番号を 0 ベースに変換して DLL に渡す', () => {
      expect(moveWindowToVirtualDesktop(100, 2)).toBe(true);
      expect(dll.moveWindowToDesktopNumber).toHaveBeenCalledWith(100, 1);
    });

    it('デスクトップ数を超える番号は DLL を呼ばずに false', () => {
      expect(moveWindowToVirtualDesktop(100, 4)).toBe(false);
      expect(dll.moveWindowToDesktopNumber).not.toHaveBeenCalled();
    });

    it('1 未満の番号は DLL を呼ばずに false', () => {
      expect(moveWindowToVirtualDesktop(100, 0)).toBe(false);
      expect(dll.moveWindowToDesktopNumber).not.toHaveBeenCalled();
    });

    it('デスクトップ数を取得できないときは上限チェックをせず DLL に任せる', () => {
      dll.getDesktopCount.mockReturnValue(0);
      dll.moveWindowToDesktopNumber.mockReturnValue(0);
      expect(moveWindowToVirtualDesktop(100, 999)).toBe(false);
      expect(dll.moveWindowToDesktopNumber).toHaveBeenCalledWith(100, 998);
    });

    it('DLL の戻り値 0 は失敗、例外も false', () => {
      dll.moveWindowToDesktopNumber.mockReturnValue(0);
      expect(moveWindowToVirtualDesktop(100, 1)).toBe(false);
      dll.moveWindowToDesktopNumber.mockImplementation(() => {
        throw new Error('dll error');
      });
      expect(moveWindowToVirtualDesktop(100, 1)).toBe(false);
    });

    it('仮想デスクトップ非対応なら false', () => {
      registry.isVirtualDesktopSupported.mockReturnValue(false);
      expect(moveWindowToVirtualDesktop(100, 1)).toBe(false);
      expect(dll.moveWindowToDesktopNumber).not.toHaveBeenCalled();
    });
  });

  describe('getDesktopCount', () => {
    it('DLL が数を返せばそれを使う', () => {
      expect(getDesktopCount()).toBe(3);
    });

    it('DLL が返せなければレジストリの GUID の数を使う', () => {
      dll.getDesktopCount.mockReturnValue(0);
      registry.getVirtualDesktopGUIDs.mockReturnValue(['{a}', '{b}']);
      expect(getDesktopCount()).toBe(2);
    });

    it('どちらも取れなければ -1', () => {
      dll.getDesktopCount.mockReturnValue(0);
      expect(getDesktopCount()).toBe(-1);
    });
  });
});
