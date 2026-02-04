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
  getAllDesktopNames,
} from '../utils/virtualDesktop/index.js';

type OperationResult = { success: boolean; error?: string };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function excludeMainWindow(windows: WindowInfo[], mainWindow: BrowserWindow | null): WindowInfo[] {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return windows;
  }
  const mainHwndValue = mainWindow.getNativeWindowHandle().readBigInt64LE(0);
  return windows.filter((win) => win.hwnd !== mainHwndValue);
}

export function setupWindowSearchHandlers(
  getMainWindow: () => BrowserWindow | null,
  getWindowPinMode: () => WindowPinMode
): void {
  function getWindowList(includeAllDesktops: boolean): WindowInfo[] {
    try {
      const windows = getAllWindows(
        includeAllDesktops ? { includeAllVirtualDesktops: true } : undefined
      );
      return excludeMainWindow(windows, getMainWindow());
    } catch (error) {
      console.error('Failed to get window list:', error);
      return [];
    }
  }

  ipcMain.handle(IPC_CHANNELS.GET_ALL_WINDOWS, async (): Promise<WindowInfo[]> => {
    return getWindowList(false);
  });

  ipcMain.handle(IPC_CHANNELS.GET_ALL_WINDOWS_ALL_DESKTOPS, async (): Promise<WindowInfo[]> => {
    return getWindowList(true);
  });

  ipcMain.handle(IPC_CHANNELS.GET_VIRTUAL_DESKTOP_INFO, async (): Promise<VirtualDesktopInfo> => {
    const unsupportedInfo: VirtualDesktopInfo = {
      supported: false,
      desktopCount: -1,
      currentDesktop: -1,
    };
    try {
      if (!isVirtualDesktopSupported()) {
        return unsupportedInfo;
      }
      return {
        supported: true,
        desktopCount: getDesktopCount(),
        currentDesktop: getCurrentDesktopNumber(),
        desktopNames: getAllDesktopNames(),
      };
    } catch (error) {
      console.error('Failed to get virtual desktop info:', error);
      return unsupportedInfo;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.ACTIVATE_WINDOW,
    async (_event, hwnd: number | bigint): Promise<OperationResult> => {
      try {
        restoreWindow(hwnd);
        const success = activateWindow(hwnd);

        if (success && getWindowPinMode() === 'normal') {
          const mainWindow = getMainWindow();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.hide();
          }
        }

        return { success };
      } catch (error) {
        console.error('Failed to activate window:', error);
        return { success: false, error: getErrorMessage(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.MOVE_WINDOW_TO_DESKTOP,
    async (_event, hwnd: number | bigint, desktopNumber: number): Promise<OperationResult> => {
      try {
        return { success: moveWindowToVirtualDesktop(hwnd, desktopNumber) };
      } catch (error) {
        console.error('Failed to move window to desktop:', error);
        return { success: false, error: getErrorMessage(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PIN_WINDOW,
    async (_event, hwnd: number | bigint): Promise<OperationResult> => {
      try {
        return { success: pinWindow(hwnd) };
      } catch (error) {
        console.error('Failed to pin window:', error);
        return { success: false, error: getErrorMessage(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.UNPIN_WINDOW,
    async (_event, hwnd: number | bigint): Promise<OperationResult> => {
      try {
        return { success: unPinWindow(hwnd) };
      } catch (error) {
        console.error('Failed to unpin window:', error);
        return { success: false, error: getErrorMessage(error) };
      }
    }
  );

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
