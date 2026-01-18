/**
 * ウィンドウ検索機能のIPCハンドラー
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { WindowPinMode, WindowInfo, VirtualDesktopInfo } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { getAllWindows, activateWindow, restoreWindow } from '../utils/nativeWindowControl';
import {
  getDesktopCount,
  getCurrentDesktopNumber,
  isVirtualDesktopSupported,
  moveWindowToVirtualDesktop,
  pinWindow,
  unPinWindow,
  isPinnedWindow,
} from '../utils/virtualDesktop/index.js';

export function setupWindowSearchHandlers(
  getMainWindow: () => BrowserWindow | null,
  getWindowPinMode: () => WindowPinMode
) {
  /**
   * すべてのウィンドウ情報を取得（QuickDashLauncher自身は除外、現在のデスクトップのみ）
   */
  ipcMain.handle(IPC_CHANNELS.GET_ALL_WINDOWS, async (): Promise<WindowInfo[]> => {
    try {
      const windows = getAllWindows();

      // QuickDashLauncher自身のウィンドウを除外
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) {
        return windows;
      }

      const mainHwnd = mainWindow.getNativeWindowHandle();
      const mainHwndValue = mainHwnd.readBigInt64LE(0);

      const filteredWindows = windows.filter((win) => win.hwnd !== mainHwndValue);

      // アイコンは既にgetAllWindows()で取得済み
      return filteredWindows;
    } catch (error) {
      console.error('Failed to get window list:', error);
      return [];
    }
  });

  /**
   * すべての仮想デスクトップのウィンドウ情報を取得（QuickDashLauncher自身は除外）
   */
  ipcMain.handle(IPC_CHANNELS.GET_ALL_WINDOWS_ALL_DESKTOPS, async (): Promise<WindowInfo[]> => {
    try {
      const windows = getAllWindows({ includeAllVirtualDesktops: true });

      // QuickDashLauncher自身のウィンドウを除外
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) {
        return windows;
      }

      const mainHwnd = mainWindow.getNativeWindowHandle();
      const mainHwndValue = mainHwnd.readBigInt64LE(0);

      const filteredWindows = windows.filter((win) => win.hwnd !== mainHwndValue);

      return filteredWindows;
    } catch (error) {
      console.error('Failed to get window list (all desktops):', error);
      return [];
    }
  });

  /**
   * 仮想デスクトップ情報を取得
   */
  ipcMain.handle(IPC_CHANNELS.GET_VIRTUAL_DESKTOP_INFO, async (): Promise<VirtualDesktopInfo> => {
    try {
      const supported = isVirtualDesktopSupported();
      if (!supported) {
        return { supported: false, desktopCount: -1, currentDesktop: -1 };
      }

      return {
        supported: true,
        desktopCount: getDesktopCount(),
        currentDesktop: getCurrentDesktopNumber(),
      };
    } catch (error) {
      console.error('Failed to get virtual desktop info:', error);
      return { supported: false, desktopCount: -1, currentDesktop: -1 };
    }
  });

  /**
   * 指定されたウィンドウをアクティブ化
   * - 最小化されている場合は復元
   * - ウィンドウをアクティブ化（フォーカス）
   * - normalモードの場合はランチャーウィンドウを非表示
   */
  ipcMain.handle(
    IPC_CHANNELS.ACTIVATE_WINDOW,
    async (_event, hwnd: number | bigint): Promise<{ success: boolean; error?: string }> => {
      try {
        // 最小化されている場合は復元
        restoreWindow(hwnd);

        // ウィンドウをアクティブ化
        const success = activateWindow(hwnd);

        if (success) {
          // ピンモードが'normal'の場合のみランチャーウィンドウを非表示
          const pinMode = getWindowPinMode();
          if (pinMode === 'normal') {
            const mainWindow = getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.hide();
            }
          }
        }

        return { success };
      } catch (error) {
        console.error('Failed to activate window:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  /**
   * 指定されたウィンドウを仮想デスクトップに移動
   */
  ipcMain.handle(
    IPC_CHANNELS.MOVE_WINDOW_TO_DESKTOP,
    async (_event, hwnd: number | bigint, desktopNumber: number): Promise<{ success: boolean; error?: string }> => {
      try {
        const success = moveWindowToVirtualDesktop(hwnd, desktopNumber);
        return { success };
      } catch (error) {
        console.error('Failed to move window to desktop:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  /**
   * 指定されたウィンドウを全ての仮想デスクトップに固定
   */
  ipcMain.handle(
    IPC_CHANNELS.PIN_WINDOW,
    async (_event, hwnd: number | bigint): Promise<{ success: boolean; error?: string }> => {
      try {
        const success = pinWindow(hwnd);
        return { success };
      } catch (error) {
        console.error('Failed to pin window:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  /**
   * 指定されたウィンドウの固定を解除
   */
  ipcMain.handle(
    IPC_CHANNELS.UNPIN_WINDOW,
    async (_event, hwnd: number | bigint): Promise<{ success: boolean; error?: string }> => {
      try {
        const success = unPinWindow(hwnd);
        return { success };
      } catch (error) {
        console.error('Failed to unpin window:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  /**
   * 指定されたウィンドウが固定されているか確認
   */
  ipcMain.handle(
    IPC_CHANNELS.IS_WINDOW_PINNED,
    async (_event, hwnd: number | bigint): Promise<boolean> => {
      try {
        return isPinnedWindow(hwnd);
      } catch (error) {
        console.error('Failed to check if window is pinned:', error);
        return false;
      }
    }
  );
}
