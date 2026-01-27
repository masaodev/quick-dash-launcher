import { DESKTOP_TAB } from '@common/constants';
import type { WindowInfo } from '@common/types';

/**
 * ウィンドウリストを仮想デスクトップタブでフィルタリング
 *
 * @param windows ウィンドウリスト
 * @param activeDesktopTab アクティブなデスクトップタブID（0=すべて, -2=ピン止め, 1以上=デスクトップ番号）
 * @returns フィルタリングされたウィンドウリスト
 */
export function filterWindowsByDesktopTab(
  windows: WindowInfo[],
  activeDesktopTab: number
): WindowInfo[] {
  if (activeDesktopTab === DESKTOP_TAB.ALL) {
    return windows;
  }
  if (activeDesktopTab === DESKTOP_TAB.PINNED) {
    return windows.filter((w) => w.isPinned === true);
  }
  return windows.filter((w) => w.desktopNumber === activeDesktopTab);
}
