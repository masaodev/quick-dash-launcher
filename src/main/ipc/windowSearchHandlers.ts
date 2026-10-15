import { ipcMain, BrowserWindow } from 'electron';
import type { WindowInfo, VirtualDesktopInfo } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';

import {
  getAllWindows,
  activateWindow,
  restoreWindow,
  getWindowShowState,
  closeWindow,
  waitForWindowsGone,
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
  switchToWindowDesktop,
} from '../utils/virtualDesktop/index.js';
import { hideMainWindowOnExecute } from '../windowManager.js';
import { getOverlayWindow } from '../services/overlayWindowService.js';

type OperationResult = { success: boolean; error?: string };

/** ウィンドウを閉じるよう頼んだ後、無くなるのを待つ上限（ms。何個閉じても 1 回だけ待つ） */
const CLOSE_WAIT_MS = 1000;

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

/**
 * QDL 自身のメインウィンドウとトースト（オーバーレイ）を一覧から外す。
 * ワークスペース・アイテム管理などは切り替え先として残す
 */
function excludeQdlWindows(
  windows: WindowInfo[],
  qdlWindows: (BrowserWindow | null)[]
): WindowInfo[] {
  const excluded = new Set(
    qdlWindows
      .filter((w): w is BrowserWindow => !!w && !w.isDestroyed())
      .map((w) => w.getNativeWindowHandle().readBigInt64LE(0))
  );
  return windows.filter((win) => !excluded.has(BigInt(win.hwnd)));
}

export function setupWindowSearchHandlers(getMainWindow: () => BrowserWindow | null): void {
  function getWindowList(includeAllDesktops: boolean): WindowInfo[] {
    try {
      const options = includeAllDesktops ? { includeAllVirtualDesktops: true } : undefined;
      return excludeQdlWindows(getAllWindows(options), [getMainWindow(), getOverlayWindow()]);
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
      // 最大化中に SW_RESTORE を送ると最大化が解けるので、最小化中だけ戻す
      if (getWindowShowState(hwnd) === 'minimized') restoreWindow(hwnd);
      // 別の仮想デスクトップのウィンドウは、そのデスクトップへ切り替えてから前に出す（そのままでは見えない）
      switchToWindowDesktop(hwnd);
      const success = activateWindow(hwnd);

      // アイテムの実行と同じ隠し方にする（固定・モーダル・初回起動中は隠さない。
      // 隠したことをレンダラーへ知らせ、検索語とモードを戻す）
      if (success) {
        hideMainWindowOnExecute();
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

  // 閉じるよう頼んだだけなので、一覧を取り直す前に少し待つ（すぐ取り直すと閉じる前のウィンドウが戻ってくる）。
  // 「保存しますか」などで閉じなければ待つのをやめ、相手の処理を待って止まらないようにする
  ipcMain.handle(
    IPC_CHANNELS.WAIT_FOR_WINDOWS_CLOSED,
    async (_event, hwnds: (number | bigint)[]) => {
      await waitForWindowsGone(hwnds, CLOSE_WAIT_MS);
    }
  );
}
