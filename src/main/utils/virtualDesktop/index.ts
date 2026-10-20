/**
 * 仮想デスクトップ制御モジュール
 *
 * koffiを使用したWindows仮想デスクトップAPIの呼び出し
 * VirtualDesktopAccessor.dllを使用してウィンドウを指定された仮想デスクトップに移動する機能を提供
 *
 * @module virtualDesktop
 */

import type { BrowserWindow } from 'electron';
import { windowLogger } from '@common/logger';

import { pinWindow, unPinWindow } from './windowOperations.js';

// レジストリアクセス機能
export { isVirtualDesktopSupported } from './registryAccess.js';

// ウィンドウ操作機能
export {
  getCurrentDesktopNumber,
  moveWindowToVirtualDesktop,
  isWindowOnDesktopNumber,
  getWindowDesktopNumber,
  getDesktopCount,
  pinWindow,
  unPinWindow,
  isPinnedWindow,
  getAllDesktopNames,
  moveWindowToCurrentDesktop,
  switchToWindowDesktop,
} from './windowOperations.js';

// DLLローダー（内部使用向け）
export { isDllLoaded } from './dllLoader.js';

/**
 * BrowserWindow のウィンドウハンドル（HWND）を取得する
 */
export function getHwnd(win: BrowserWindow): bigint {
  return win.getNativeWindowHandle().readBigUInt64LE();
}

/**
 * ウィンドウの全仮想デスクトップ表示（固定）を当てる・外す
 *
 * 隠れているウィンドウには当てられない（失敗する）ので何もしない。表示するときに当て直す
 * @param label ログに出すウィンドウの名前（例: ワークスペース）
 */
export function applyAllDesktopsPin(win: BrowserWindow, enabled: boolean, label: string): void {
  if (win.isDestroyed() || !win.isVisible()) return;
  const hwnd = getHwnd(win);
  const success = enabled ? pinWindow(hwnd) : unPinWindow(hwnd);
  const action = enabled ? 'pin' : 'unpin';
  if (success) {
    windowLogger.info(`${label}の仮想デスクトップ固定: ${action}`);
  } else {
    windowLogger.warn(`${label}の仮想デスクトップ固定に失敗: ${action}`);
  }
}
