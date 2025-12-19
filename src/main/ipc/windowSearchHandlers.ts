/**
 * ウィンドウ検索機能のIPCハンドラー
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { WindowPinMode, WindowInfo } from '@common/types';

import { getAllWindows, activateWindow, restoreWindow } from '../utils/nativeWindowControl';

export function setupWindowSearchHandlers(
  getMainWindow: () => BrowserWindow | null,
  getWindowPinMode: () => WindowPinMode
) {
  /**
   * すべてのウィンドウ情報を取得（QuickDashLauncher自身は除外）
   */
  ipcMain.handle('get-all-windows', async (): Promise<WindowInfo[]> => {
    try {
      const windows = getAllWindows();

      // QuickDashLauncher自身のウィンドウを除外
      const mainWindow = getMainWindow();
      if (!mainWindow || mainWindow.isDestroyed()) {
        return windows;
      }

      const mainHwnd = mainWindow.getNativeWindowHandle();
      const mainHwndValue = mainHwnd.readBigInt64LE(0);

      return windows.filter((win) => win.hwnd !== mainHwndValue);
    } catch (error) {
      console.error('Failed to get window list:', error);
      return [];
    }
  });

  /**
   * 指定されたウィンドウをアクティブ化
   * - 最小化されている場合は復元
   * - ウィンドウをアクティブ化（フォーカス）
   * - normalモードの場合はランチャーウィンドウを非表示
   */
  ipcMain.handle(
    'activate-window',
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
