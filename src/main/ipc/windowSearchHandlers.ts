/**
 * ウィンドウ検索機能のIPCハンドラー
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { WindowPinMode, WindowInfo } from '@common/types';
import {
  GET_ALL_WINDOWS,
  GET_ALL_WINDOWS_ALL_DESKTOPS,
  GET_VIRTUAL_DESKTOP_INFO,
  ACTIVATE_WINDOW,
} from '@common/ipcChannels';

import { getAllWindows, activateWindow, restoreWindow } from '../utils/nativeWindowControl';
import {
  getDesktopCount,
  getCurrentDesktopNumber,
  isVirtualDesktopSupported,
} from '../utils/virtualDesktop/index.js';

/** 仮想デスクトップ情報 */
interface VirtualDesktopInfo {
  /** 仮想デスクトップがサポートされているか */
  supported: boolean;
  /** デスクトップ数（サポートされていない場合は-1） */
  desktopCount: number;
  /** 現在のデスクトップ番号（1から開始、サポートされていない場合は-1） */
  currentDesktop: number;
}

export function setupWindowSearchHandlers(
  getMainWindow: () => BrowserWindow | null,
  getWindowPinMode: () => WindowPinMode
) {
  /**
   * すべてのウィンドウ情報を取得（QuickDashLauncher自身は除外、現在のデスクトップのみ）
   */
  ipcMain.handle(GET_ALL_WINDOWS, async (): Promise<WindowInfo[]> => {
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
  ipcMain.handle(GET_ALL_WINDOWS_ALL_DESKTOPS, async (): Promise<WindowInfo[]> => {
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
  ipcMain.handle(GET_VIRTUAL_DESKTOP_INFO, async (): Promise<VirtualDesktopInfo> => {
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
    ACTIVATE_WINDOW,
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
}
