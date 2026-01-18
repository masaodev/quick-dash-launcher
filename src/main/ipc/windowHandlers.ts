import { ipcMain, app, clipboard } from 'electron';
import type { WindowPinMode } from '@common/types';
import { windowLogger } from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

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
  ipcMain.handle(IPC_CHANNELS.GET_WINDOW_PIN_MODE, () => {
    return getWindowPinMode();
  });

  ipcMain.handle(IPC_CHANNELS.CYCLE_WINDOW_PIN_MODE, () => {
    return cycleWindowPinMode();
  });

  ipcMain.handle(IPC_CHANNELS.QUIT_APP, () => {
    const tray = getTray();
    if (tray) {
      tray.destroy();
    }
    app.quit();
  });

  ipcMain.handle(IPC_CHANNELS.SET_EDIT_MODE, async (_event, editMode: boolean) => {
    await setEditMode(editMode);
  });

  ipcMain.handle(IPC_CHANNELS.GET_EDIT_MODE, () => {
    return getEditMode();
  });

  // 管理ウィンドウ関連のIPCハンドラー
  ipcMain.handle(IPC_CHANNELS.SHOW_EDIT_WINDOW, async () => {
    await showAdminWindow();
  });

  ipcMain.handle(IPC_CHANNELS.HIDE_EDIT_WINDOW, () => {
    hideAdminWindow();
  });

  ipcMain.handle(IPC_CHANNELS.TOGGLE_EDIT_WINDOW, async () => {
    await toggleAdminWindow();
  });

  ipcMain.handle(IPC_CHANNELS.IS_EDIT_WINDOW_SHOWN, () => {
    return isAdminWindowShown();
  });

  ipcMain.handle(
    IPC_CHANNELS.OPEN_EDIT_WINDOW_WITH_TAB,
    async (_event, tab: 'settings' | 'edit' | 'other') => {
      await showAdminWindowWithTab(tab);
    }
  );

  // アーカイブタブを開くIPCハンドラー
  ipcMain.handle(IPC_CHANNELS.ADMIN_SHOW_ARCHIVE_TAB, async () => {
    await showAdminWindowWithTab('archive');
  });

  ipcMain.handle(IPC_CHANNELS.GET_INITIAL_TAB, () => {
    return getInitialTab();
  });

  ipcMain.handle(IPC_CHANNELS.COPY_TO_CLIPBOARD, (_event, text: string) => {
    try {
      clipboard.writeText(text);
      return true;
    } catch (_error) {
      return false;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.SET_MODAL_MODE,
    async (_event, isModal: boolean, requiredSize?: { width: number; height: number }) => {
      await setModalMode(isModal, requiredSize);
    }
  );

  // パフォーマンス計測のIPCハンドラー
  ipcMain.handle(IPC_CHANNELS.LOG_PERFORMANCE_TIMING, (_event, label: string, duration: number) => {
    windowLogger.info(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
  });

  // ワークスペースウィンドウ関連のIPCハンドラー
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_TOGGLE_WINDOW, async () => {
    await toggleWorkspaceWindow();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SHOW_WINDOW, async () => {
    await showWorkspaceWindow();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_HIDE_WINDOW, () => {
    hideWorkspaceWindow();
    return true;
  });

  // ワークスペースウィンドウのピン留め関連ハンドラー
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_ALWAYS_ON_TOP, () => {
    return getWorkspaceAlwaysOnTop();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_TOGGLE_ALWAYS_ON_TOP, () => {
    return toggleWorkspaceAlwaysOnTop();
  });

  // ワークスペースウィンドウのモーダルモード関連ハンドラー
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SET_MODAL_MODE,
    (_event, isModal: boolean, requiredSize?: { width: number; height: number }) => {
      setWorkspaceModalMode(isModal, requiredSize);
    }
  );

  // ワークスペースウィンドウの透過度設定ハンドラー
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SET_OPACITY, async (_event, opacityPercent: number) => {
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
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_OPACITY, async () => {
    try {
      const settingsService = await SettingsService.getInstance();
      return await settingsService.get('workspaceOpacity');
    } catch (error) {
      windowLogger.error({ error }, 'Failed to get workspace opacity');
      return 100;
    }
  });

  // ワークスペースウィンドウのサイズ変更ハンドラー
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SET_SIZE, (_event, width: number, height: number) => {
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
    IPC_CHANNELS.WORKSPACE_SET_POSITION_AND_SIZE,
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
