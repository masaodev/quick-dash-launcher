import { ipcMain, app, clipboard } from 'electron';
import type { WindowPinMode } from '@common/types';
import { windowLogger } from '@common/logger';

import {
  showAdminWindow,
  hideAdminWindow,
  toggleAdminWindow,
  isAdminWindowShown,
  showAdminWindowWithTab,
  getInitialTab,
} from '../adminWindowManager.js';
import { getTray } from '../windowManager.js';

export function setupWindowHandlers(
  setEditMode: (editMode: boolean) => Promise<void>,
  getEditMode: () => boolean,
  getWindowPinMode: () => WindowPinMode,
  cycleWindowPinMode: () => WindowPinMode,
  setModalMode: (
    isModal: boolean,
    requiredSize?: { width: number; height: number }
  ) => Promise<void>
) {
  // 3段階ピンモード用のIPCハンドラー
  ipcMain.handle('get-window-pin-mode', () => {
    return getWindowPinMode();
  });

  ipcMain.handle('cycle-window-pin-mode', () => {
    return cycleWindowPinMode();
  });

  ipcMain.handle('quit-app', () => {
    const tray = getTray();
    if (tray) {
      tray.destroy();
    }
    app.quit();
  });

  ipcMain.handle('set-edit-mode', async (_event, editMode: boolean) => {
    await setEditMode(editMode);
  });

  ipcMain.handle('get-edit-mode', () => {
    return getEditMode();
  });

  // 管理ウィンドウ関連のIPCハンドラー
  ipcMain.handle('show-edit-window', async () => {
    await showAdminWindow();
  });

  ipcMain.handle('hide-edit-window', () => {
    hideAdminWindow();
  });

  ipcMain.handle('toggle-edit-window', async () => {
    await toggleAdminWindow();
  });

  ipcMain.handle('is-edit-window-shown', () => {
    return isAdminWindowShown();
  });

  ipcMain.handle(
    'open-edit-window-with-tab',
    async (_event, tab: 'settings' | 'edit' | 'other') => {
      await showAdminWindowWithTab(tab);
    }
  );

  ipcMain.handle('get-initial-tab', () => {
    return getInitialTab();
  });

  ipcMain.handle('copy-to-clipboard', (_event, text: string) => {
    try {
      clipboard.writeText(text);
      return true;
    } catch (_error) {
      return false;
    }
  });

  ipcMain.handle(
    'set-modal-mode',
    async (_event, isModal: boolean, requiredSize?: { width: number; height: number }) => {
      await setModalMode(isModal, requiredSize);
    }
  );

  // パフォーマンス計測のIPCハンドラー
  ipcMain.handle('log-performance-timing', (_event, label: string, duration: number) => {
    windowLogger.info(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
  });
}
