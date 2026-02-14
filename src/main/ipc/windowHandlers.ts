import { ipcMain, app, clipboard, screen } from 'electron';
import type { WindowPinMode, WorkspacePositionMode } from '@common/types';
import { windowLogger } from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { SettingsService } from '../services/settingsService.js';
import {
  showAdminWindow,
  hideAdminWindow,
  toggleAdminWindow,
  isAdminWindowShown,
  showAdminWindowWithTab,
  showAdminWindowWithImportModal,
  getInitialTab,
  getPendingImportModal,
} from '../adminWindowManager.js';
import {
  toggleWorkspaceWindow,
  showWorkspaceWindow,
  hideWorkspaceWindow,
  getWorkspaceAlwaysOnTop,
  toggleWorkspaceAlwaysOnTop,
  setWorkspaceModalMode,
  getWorkspaceWindow,
  setWorkspacePosition,
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
  ipcMain.handle(IPC_CHANNELS.GET_WINDOW_PIN_MODE, () => getWindowPinMode());
  ipcMain.handle(IPC_CHANNELS.CYCLE_WINDOW_PIN_MODE, () => cycleWindowPinMode());

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
  ipcMain.handle(IPC_CHANNELS.GET_EDIT_MODE, () => getEditMode());

  ipcMain.handle(IPC_CHANNELS.SHOW_EDIT_WINDOW, () => showAdminWindow());
  ipcMain.handle(IPC_CHANNELS.HIDE_EDIT_WINDOW, () => hideAdminWindow());
  ipcMain.handle(IPC_CHANNELS.TOGGLE_EDIT_WINDOW, () => toggleAdminWindow());
  ipcMain.handle(IPC_CHANNELS.IS_EDIT_WINDOW_SHOWN, () => isAdminWindowShown());

  ipcMain.handle(
    IPC_CHANNELS.OPEN_EDIT_WINDOW_WITH_TAB,
    async (_event, tab: 'settings' | 'edit' | 'other') => showAdminWindowWithTab(tab)
  );

  ipcMain.handle(
    IPC_CHANNELS.OPEN_EDIT_WINDOW_WITH_IMPORT_MODAL,
    async (_event, modal: 'bookmark' | 'app') => showAdminWindowWithImportModal(modal)
  );

  ipcMain.handle(IPC_CHANNELS.ADMIN_SHOW_ARCHIVE_TAB, () => showAdminWindowWithTab('archive'));
  ipcMain.handle(IPC_CHANNELS.GET_INITIAL_TAB, () => getInitialTab());
  ipcMain.handle(IPC_CHANNELS.GET_PENDING_IMPORT_MODAL, () => getPendingImportModal());

  ipcMain.handle(IPC_CHANNELS.COPY_TO_CLIPBOARD, (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle(
    IPC_CHANNELS.SET_MODAL_MODE,
    async (_event, isModal: boolean, requiredSize?: { width: number; height: number }) => {
      await setModalMode(isModal, requiredSize);
    }
  );

  ipcMain.handle(IPC_CHANNELS.LOG_PERFORMANCE_TIMING, (_event, label: string, duration: number) => {
    windowLogger.info(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_TOGGLE_WINDOW, () => toggleWorkspaceWindow());
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SHOW_WINDOW, () => showWorkspaceWindow());
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_HIDE_WINDOW, () => {
    hideWorkspaceWindow();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_ALWAYS_ON_TOP, () => getWorkspaceAlwaysOnTop());
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_TOGGLE_ALWAYS_ON_TOP, () => toggleWorkspaceAlwaysOnTop());

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SET_MODAL_MODE,
    (_event, isModal: boolean, requiredSize?: { width: number; height: number }) => {
      setWorkspaceModalMode(isModal, requiredSize);
    }
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SET_OPACITY, async (_event, opacityPercent: number) => {
    const validOpacity = Math.max(0, Math.min(100, opacityPercent));

    const settingsService = await SettingsService.getInstance();
    await settingsService.set('workspaceOpacity', validOpacity);

    const workspace = getWorkspaceWindow();
    if (workspace && !workspace.isDestroyed()) {
      workspace.setOpacity(validOpacity / 100);
    }

    windowLogger.info(`Workspace opacity set to ${validOpacity}%`);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_OPACITY, async () => {
    const settingsService = await SettingsService.getInstance();
    return await settingsService.get('workspaceOpacity');
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SET_SIZE, (_event, width: number, height: number) => {
    const workspace = getWorkspaceWindow();
    if (!workspace || workspace.isDestroyed()) return false;

    const { x, y } = workspace.getBounds();
    workspace.setBounds({ x, y, width: Math.round(width), height: Math.round(height) });
    windowLogger.info(`Workspace size set to ${width}x${height}`);
    return true;
  });

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SET_POSITION_AND_SIZE,
    (_event, x: number, y: number, width: number, height: number) => {
      const workspace = getWorkspaceWindow();
      if (!workspace || workspace.isDestroyed()) return false;

      workspace.setBounds({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });
      windowLogger.info(`Workspace position and size set to ${width}x${height} at (${x}, ${y})`);
      return true;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SET_POSITION_MODE,
    async (_event, mode: WorkspacePositionMode) => {
      const settingsService = await SettingsService.getInstance();
      if (mode === 'displayLeft' || mode === 'displayRight') {
        const cursorPoint = screen.getCursorScreenPoint();
        const cursorDisplay = screen.getDisplayNearestPoint(cursorPoint);
        const allDisplays = screen.getAllDisplays();
        const displayIndex = allDisplays.findIndex((d) => d.id === cursorDisplay.id);
        await settingsService.set(
          'workspaceTargetDisplayIndex',
          displayIndex >= 0 ? displayIndex : 0
        );
      }
      await settingsService.set('workspacePositionMode', mode);
      await setWorkspacePosition(mode);
      windowLogger.info(`Workspace position mode set to ${mode}`);
      return true;
    }
  );
}
