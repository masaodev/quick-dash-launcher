import { ipcMain, app, clipboard } from 'electron';
import type { WindowPinMode } from '@common/types';
import { windowLogger } from '@common/logger';

import { SettingsService } from '../services/settingsService.js';
import {
  showAdminWindow,
  hideAdminWindow,
  toggleAdminWindow,
  isAdminWindowShown,
  showAdminWindowWithTab,
  getInitialTab,
} from '../adminWindowManager.js';
import {
  toggleWorkspaceWindow,
  showWorkspaceWindow,
  hideWorkspaceWindow,
  getWorkspaceAlwaysOnTop,
  toggleWorkspaceAlwaysOnTop,
  setWorkspaceModalMode,
  getWorkspaceWindow,
} from '../workspaceWindowManager.js';
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

  // ワークスペースウィンドウ関連のIPCハンドラー
  ipcMain.handle('workspace:toggle-window', async () => {
    await toggleWorkspaceWindow();
  });

  ipcMain.handle('workspace:show-window', async () => {
    await showWorkspaceWindow();
  });

  ipcMain.handle('workspace:hide-window', () => {
    hideWorkspaceWindow();
    return true;
  });

  // ワークスペースウィンドウのピン留め関連ハンドラー
  ipcMain.handle('workspace:get-always-on-top', () => {
    return getWorkspaceAlwaysOnTop();
  });

  ipcMain.handle('workspace:toggle-always-on-top', () => {
    return toggleWorkspaceAlwaysOnTop();
  });

  // ワークスペースウィンドウのモーダルモード関連ハンドラー
  ipcMain.handle(
    'workspace:set-modal-mode',
    (_event, isModal: boolean, requiredSize?: { width: number; height: number }) => {
      setWorkspaceModalMode(isModal, requiredSize);
    }
  );

  // ワークスペースウィンドウの透過度設定ハンドラー
  ipcMain.handle('workspace:set-opacity', async (_event, opacityPercent: number) => {
    try {
      // 値の検証（0-100の範囲にクリップ）
      const validOpacity = Math.max(0, Math.min(100, opacityPercent));
      const opacityValue = validOpacity / 100;

      // 設定を保存
      const settingsService = await SettingsService.getInstance();
      await settingsService.set('workspaceOpacity', validOpacity);

      // ウィンドウに反映
      const workspace = getWorkspaceWindow();
      if (workspace && !workspace.isDestroyed()) {
        workspace.setOpacity(opacityValue);
      }

      windowLogger.info(`Workspace opacity set to ${validOpacity}%`);
      return true;
    } catch (error) {
      windowLogger.error({ error }, 'Failed to set workspace opacity');
      throw error;
    }
  });

  // ワークスペースウィンドウの現在の透過度を取得
  ipcMain.handle('workspace:get-opacity', async () => {
    try {
      const settingsService = await SettingsService.getInstance();
      return await settingsService.get('workspaceOpacity');
    } catch (error) {
      windowLogger.error({ error }, 'Failed to get workspace opacity');
      return 100;
    }
  });

  // ワークスペースウィンドウのサイズ変更ハンドラー
  ipcMain.handle('workspace:set-size', (_event, width: number, height: number) => {
    try {
      const workspace = getWorkspaceWindow();
      if (workspace && !workspace.isDestroyed()) {
        const bounds = workspace.getBounds();
        workspace.setBounds({
          x: bounds.x,
          y: bounds.y,
          width: Math.round(width),
          height: Math.round(height),
        });
        windowLogger.info(`Workspace size set to ${width}x${height}`);
        return true;
      }
      return false;
    } catch (error) {
      windowLogger.error({ error }, 'Failed to set workspace size');
      throw error;
    }
  });

  // ワークスペースウィンドウの位置とサイズを同時に変更するハンドラー（絶対座標）
  ipcMain.handle(
    'workspace:set-position-and-size',
    (_event, x: number, y: number, width: number, height: number) => {
      try {
        const workspace = getWorkspaceWindow();
        if (workspace && !workspace.isDestroyed()) {
          workspace.setBounds({
            x: Math.round(x),
            y: Math.round(y),
            width: Math.round(width),
            height: Math.round(height),
          });
          windowLogger.info(
            `Workspace position and size set to ${width}x${height} at (${x}, ${y})`
          );
          return true;
        }
        return false;
      } catch (error) {
        windowLogger.error({ error }, 'Failed to set workspace position and size');
        throw error;
      }
    }
  );
}
