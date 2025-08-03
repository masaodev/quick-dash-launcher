import { ipcMain, app, clipboard } from 'electron';
import type { WindowPinMode } from '@common/types';

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
  getWindowPinState: () => boolean,
  setWindowPinState: (pinState: boolean) => void,
  setEditMode: (editMode: boolean) => Promise<void>,
  getEditMode: () => boolean,
  getWindowPinMode: () => WindowPinMode,
  cycleWindowPinMode: () => WindowPinMode,
  setModalMode: (
    isModal: boolean,
    requiredSize?: { width: number; height: number }
  ) => Promise<void>
) {
  // 新しい3段階モード用のIPCハンドラー
  ipcMain.handle('get-window-pin-mode', () => {
    return getWindowPinMode();
  });

  ipcMain.handle('cycle-window-pin-mode', () => {
    return cycleWindowPinMode();
  });

  // 旧APIとの互換性のためのIPCハンドラー（非推奨）
  ipcMain.handle('get-window-pin-state', () => {
    return getWindowPinState();
  });

  ipcMain.handle('set-window-pin-state', (_event, isPinned: boolean) => {
    setWindowPinState(isPinned);
  });

  ipcMain.handle('quit-app', () => {
    const tray = getTray();
    if (tray) {
      tray.destroy();
    }
    app.exit(0);
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
}
