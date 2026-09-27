import { ipcMain, app, clipboard, screen, BrowserWindow } from 'electron';
import type {
  MainChildWindowRequest,
  MainChildWindowResult,
  WindowPinMode,
  WorkspacePositionMode,
} from '@common/types';
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
import { openWorkspaceItemEditor } from '../workspaceItemEditorWindowManager.js';
import {
  openMainChildWindow,
  getMainChildWindowRequest,
  relayMainChildWindowResult,
} from '../mainChildWindowManager.js';
import {
  createDetachedGroupWindow,
  closeDetachedGroupWindow,
  showWithoutFocus,
  hideAllDetachedGroupWindows,
  showAllDetachedGroupWindows,
  getGroupIdByWebContentsId,
  getDetachedPinMode,
  cycleDetachedPinMode,
} from '../detachedGroupWindowManager.js';
import { WorkspaceService } from '../services/workspace/index.js';
import { getTray } from '../windowManager.js';

export function setupWindowHandlers(
  getWindowPinMode: () => WindowPinMode,
  cycleWindowPinMode: () => WindowPinMode
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

  ipcMain.handle(IPC_CHANNELS.GET_INITIAL_TAB, () => getInitialTab());
  ipcMain.handle(IPC_CHANNELS.GET_PENDING_IMPORT_MODAL, () => getPendingImportModal());

  ipcMain.handle(IPC_CHANNELS.COPY_TO_CLIPBOARD, async (_event, text: string) => {
    await clipboard.writeText(text);
    return true;
  });

  // メイン画面の子ウィンドウ（アイテムの登録・編集、アイコン取得結果）。閉じるまで待つ
  ipcMain.handle(IPC_CHANNELS.OPEN_MAIN_CHILD_WINDOW, (_event, request: MainChildWindowRequest) =>
    openMainChildWindow(request)
  );
  ipcMain.handle(IPC_CHANNELS.GET_MAIN_CHILD_WINDOW_REQUEST, (_event, requestId: string) =>
    getMainChildWindowRequest(requestId)
  );
  ipcMain.on(
    IPC_CHANNELS.NOTIFY_MAIN_CHILD_WINDOW_RESULT,
    (_event, result: MainChildWindowResult) => relayMainChildWindowResult(result)
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

  // 編集は送信元（ワークスペース本体または切り離しウィンドウ）を親にした子ウィンドウで開く
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_OPEN_ITEM_EDITOR, (event, itemId: string) =>
    openWorkspaceItemEditor(event.sender, itemId)
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

  // 切り離しウィンドウ
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_DETACH_GROUP,
    (_event, groupId: string, cursorX?: number, cursorY?: number) =>
      createDetachedGroupWindow(groupId, cursorX, cursorY)
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CLOSE_DETACHED_GROUP, (_event, groupId: string) =>
    closeDetachedGroupWindow(groupId)
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_CALLER_PIN_MODE, (event) => {
    const groupId = getGroupIdByWebContentsId(event.sender.id);
    if (!groupId) return 0;
    return getDetachedPinMode(groupId);
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CYCLE_CALLER_PIN_MODE, async (event) => {
    const groupId = getGroupIdByWebContentsId(event.sender.id);
    if (!groupId) return 0;
    const newMode = cycleDetachedPinMode(groupId);
    // ピンモードを永続化
    const ws = await WorkspaceService.getInstance();
    await ws.saveDetachedPinMode(groupId, newMode);
    return newMode;
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_HIDE_ALL_DETACHED, () => hideAllDetachedGroupWindows());
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_SHOW_ALL_DETACHED, () => showAllDetachedGroupWindows());

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_RESIZE_CALLER_WINDOW,
    (event, width: number, height: number) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed()) return false;

      const { x, y } = win.getBounds();
      win.setBounds({ x, y, width: Math.round(width), height: Math.round(height) });

      // autofit完了後、フォーカスを奪わずに初回表示
      if (!win.isVisible()) {
        showWithoutFocus(win);
      }

      return true;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SET_CALLER_BOUNDS,
    (event, x: number, y: number, width: number, height: number) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed()) return false;

      win.setBounds({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });
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
