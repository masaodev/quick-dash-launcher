import { ipcMain, BrowserWindow } from 'electron';
import type { WindowPinMode, WindowInfo, VirtualDesktopInfo } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';

import {
  getAllWindows,
  activateWindow,
  restoreWindow,
  closeWindow,
} from '../utils/nativeWindowControl';
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

function safeWindowOperation<T extends unknown[]>(
  fn: (...args: T) => boolean,
  errorLabel: string
): (...args: T) => OperationResult {
  return (...args: T) => {
    try {
      return { success: fn(...args) };
    } catch (error) {
      console.error(`Failed to ${errorLabel}:`, error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
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
      const options = includeAllDesktops ? { includeAllVirtualDesktops: true } : undefined;
      return excludeMainWindow(getAllWindows(options), getMainWindow());
    } catch (error) {
      console.error('Failed to get window list:', error);
      return [];
    }
  }

  ipcMain.handle(IPC_CHANNELS.GET_ALL_WINDOWS, (): WindowInfo[] => getWindowList(false));
  ipcMain.handle(IPC_CHANNELS.GET_ALL_WINDOWS_ALL_DESKTOPS, (): WindowInfo[] =>
    getWindowList(true)
  );

  ipcMain.handle(IPC_CHANNELS.GET_VIRTUAL_DESKTOP_INFO, (): VirtualDesktopInfo => {
    try {
      if (!isVirtualDesktopSupported()) {
        return { supported: false, desktopCount: -1, currentDesktop: -1 };
      }
      return {
        supported: true,
        desktopCount: getDesktopCount(),
        currentDesktop: getCurrentDesktopNumber(),
        desktopNames: getAllDesktopNames(),
      };
    } catch (error) {
      console.error('Failed to get virtual desktop info:', error);
      return { supported: false, desktopCount: -1, currentDesktop: -1 };
    }
  });

  ipcMain.handle(IPC_CHANNELS.ACTIVATE_WINDOW, (_event, hwnd: number | bigint): OperationResult => {
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
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.MOVE_WINDOW_TO_DESKTOP,
    (_event, hwnd: number | bigint, desktopNumber: number) =>
      safeWindowOperation(moveWindowToVirtualDesktop, 'move window to desktop')(hwnd, desktopNumber)
  );

  ipcMain.handle(IPC_CHANNELS.PIN_WINDOW, (_event, hwnd: number | bigint) =>
    safeWindowOperation(pinWindow, 'pin window')(hwnd)
  );

  ipcMain.handle(IPC_CHANNELS.UNPIN_WINDOW, (_event, hwnd: number | bigint) =>
    safeWindowOperation(unPinWindow, 'unpin window')(hwnd)
  );

  ipcMain.handle(IPC_CHANNELS.IS_WINDOW_PINNED, (_event, hwnd: number | bigint): boolean => {
    try {
      return isPinnedWindow(hwnd);
    } catch (error) {
      console.error('Failed to check if window is pinned:', error);
      return false;
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, (_event, hwnd: number | bigint) =>
    safeWindowOperation(closeWindow, 'close window')(hwnd)
  );
}
