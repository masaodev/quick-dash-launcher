/**
 * 仮想デスクトップ制御モジュール
 *
 * koffiを使用したWindows仮想デスクトップAPIの呼び出し
 * VirtualDesktopAccessor.dllを使用してウィンドウを指定された仮想デスクトップに移動する機能を提供
 *
 * @module virtualDesktop
 */

// レジストリアクセス機能
export { isVirtualDesktopSupported, getVirtualDesktopGUIDs } from './registryAccess.js';

// GUID変換ユーティリティ
export { bufferToGuidString } from './guidUtils.js';

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
} from './windowOperations.js';

// DLLローダー（内部使用向け）
export { isDllLoaded } from './dllLoader.js';
