import { ipcMain, app, clipboard, screen, BrowserWindow } from 'electron';
import type { WebContents } from 'electron';
import type {
  MainChildWindowRequest,
  MainChildWindowResult,
  MainChildWindowReturn,
  ConfirmWindowRequest,
  ConfirmWindowResult,
  PinLevel,
  WindowPinMode,
  WorkspacePositionMode,
  AdminTab,
} from '@common/types';
import { MAIN_WINDOW_DISPLAY_INDEX } from '@common/types';
import { windowLogger } from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { SettingsService } from '../services/settingsService.js';
import { readClipboardFilePaths } from '../services/clipboardService.js';
import {
  hideAdminWindow,
  toggleAdminWindow,
  showAdminWindowWithTab,
  showAdminWindowWithImportModal,
  getInitialTab,
  getPendingImportModal,
} from '../adminWindowManager.js';
import {
  toggleWorkspaceWindow,
  hideWorkspaceWindow,
  getWorkspaceAlwaysOnTop,
  toggleWorkspaceAlwaysOnTop,
  getWorkspacePinLevel,
  isWorkspaceWindowOpen,
  setWorkspacePinLevel,
  getWorkspaceWindow,
  setWorkspacePosition,
} from '../workspaceWindowManager.js';
import {
  openWorkspaceItemEditor,
  openWorkspaceNewItemEditor,
} from '../workspaceItemEditorWindowManager.js';
import { openWorkspaceItemPicker } from '../workspaceItemPickerWindowManager.js';
import { openWorkspaceLinkCopies, openWorkspaceLinkPicker } from '../workspaceLinkWindowManager.js';
import {
  getWorkspaceConfirmRequest,
  openWorkspaceConfirm,
  setWorkspaceConfirmResult,
} from '../workspaceConfirmWindowManager.js';
import {
  openMainChildWindow,
  getMainChildWindowRequest,
  relayMainChildWindowResult,
  setMainChildWindowReturn,
} from '../mainChildWindowManager.js';
import {
  createDetachedGroupWindow,
  closeDetachedGroupWindow,
  showWithoutFocus,
  getGroupIdByWebContentsId,
  getDetachedPinLevel,
  setDetachedPinLevel,
  getDetachedAlwaysOnTop,
  toggleDetachedAlwaysOnTop,
  isDetachedGroupWindow,
  takeDetachedInitialShow,
  rememberDetachedBoundsFromRenderer,
} from '../detachedGroupWindowManager.js';
import { WorkspaceService } from '../services/workspace/index.js';
import { getMainWindow, getTray, setEscapeHandledByPage } from '../windowManager.js';
import { isPinLevel, levelToPinMode, pinModeToLevel, showPinMenu } from '../utils/pinMenu.js';
import { startWindowMove } from '../utils/nativeWindowControl.js';
import { getHwnd } from '../utils/virtualDesktop/index.js';
import { handleIpc } from '../utils/ipcWrapper';

/** ピン留めの対象（送ってきたウィンドウ）ごとの読み書き */
interface PinTarget {
  window: BrowserWindow;
  get: () => PinLevel;
  set: (level: PinLevel) => Promise<void>;
}

/**
 * 編集画面（子ウィンドウ）を開いた元が切り離しウィンドウなら、その groupId を返す（ワークスペース本体なら undefined）
 */
function getEditorOpenerGroupId(sender: WebContents): string | undefined {
  const opener = BrowserWindow.fromWebContents(sender)?.getParentWindow();
  return opener ? getGroupIdByWebContentsId(opener.webContents.id) : undefined;
}

export function setupWindowHandlers(
  getWindowPinMode: () => WindowPinMode,
  setWindowPinMode: (mode: WindowPinMode) => void
) {
  /** 送ってきたウィンドウがメイン・ワークスペース・切り離しのどれかを調べる */
  const resolvePinTarget = (sender: WebContents): PinTarget | null => {
    const win = BrowserWindow.fromWebContents(sender);
    if (!win) return null;
    if (win === getMainWindow()) {
      return {
        window: win,
        get: () => pinModeToLevel(getWindowPinMode()),
        set: async (level) => setWindowPinMode(levelToPinMode(level)),
      };
    }
    if (win === getWorkspaceWindow()) {
      return {
        window: win,
        get: () => getWorkspacePinLevel(),
        set: async (level) => {
          setWorkspacePinLevel(level);
        },
      };
    }
    const groupId = getGroupIdByWebContentsId(sender.id);
    if (groupId) {
      return {
        window: win,
        get: () => getDetachedPinLevel(groupId),
        set: async (level) => {
          setDetachedPinLevel(groupId, level);
          const ws = await WorkspaceService.getInstance();
          await ws.saveDetachedPinMode(groupId, level);
        },
      };
    }
    return null;
  };

  handleIpc(IPC_CHANNELS.PIN_GET, (event): PinLevel => {
    return resolvePinTarget(event.sender)?.get() ?? 0;
  });

  handleIpc(IPC_CHANNELS.PIN_SET, async (event, level: unknown): Promise<PinLevel> => {
    const target = resolvePinTarget(event.sender);
    if (!target) return 0;
    if (isPinLevel(level)) {
      await target.set(level);
    }
    return target.get();
  });

  handleIpc(IPC_CHANNELS.PIN_SHOW_MENU, async (event): Promise<PinLevel> => {
    const target = resolvePinTarget(event.sender);
    if (!target) return 0;
    const current = target.get();
    const next = await showPinMenu(target.window, current);
    if (next !== current) {
      await target.set(next);
    }
    return target.get();
  });

  handleIpc(IPC_CHANNELS.QUIT_APP, () => {
    const tray = getTray();
    if (tray) {
      tray.destroy();
    }
    app.quit();
  });

  handleIpc(IPC_CHANNELS.HIDE_EDIT_WINDOW, () => hideAdminWindow());
  handleIpc(IPC_CHANNELS.TOGGLE_EDIT_WINDOW, () => toggleAdminWindow());

  handleIpc(IPC_CHANNELS.OPEN_EDIT_WINDOW_WITH_TAB, async (_event, tab: AdminTab) =>
    showAdminWindowWithTab(tab)
  );

  handleIpc(
    IPC_CHANNELS.OPEN_EDIT_WINDOW_WITH_IMPORT_MODAL,
    async (_event, modal: 'bookmark' | 'app') => showAdminWindowWithImportModal(modal)
  );

  handleIpc(IPC_CHANNELS.GET_INITIAL_TAB, () => getInitialTab());
  handleIpc(IPC_CHANNELS.GET_PENDING_IMPORT_MODAL, () => getPendingImportModal());

  handleIpc(IPC_CHANNELS.COPY_TO_CLIPBOARD, async (_event, text: string) => {
    await clipboard.writeText(text);
    return true;
  });

  // メインウィンドウの余白の右クリック「クリップボードのパス・URL から追加」。振り分けはレンダラーが行う
  // （この版の Electron では clipboard.readText は Promise を返すので待つ）
  handleIpc(IPC_CHANNELS.CLIPBOARD_READ_FOR_REGISTER, async () => ({
    files: readClipboardFilePaths(),
    text: await clipboard.readText(),
  }));

  // メイン画面・管理画面の子ウィンドウ（アイテムの登録・編集、アイコン取得結果）。閉じるまで待つ
  handleIpc(IPC_CHANNELS.OPEN_MAIN_CHILD_WINDOW, (event, request: MainChildWindowRequest) =>
    openMainChildWindow(request, event.sender)
  );
  handleIpc(IPC_CHANNELS.GET_MAIN_CHILD_WINDOW_REQUEST, (_event, requestId: string) =>
    getMainChildWindowRequest(requestId)
  );
  ipcMain.on(IPC_CHANNELS.WINDOW_SET_ESCAPE_HANDLED_BY_PAGE, (_event, handled: boolean) =>
    setEscapeHandledByPage(handled)
  );
  ipcMain.on(IPC_CHANNELS.WINDOW_START_MOVE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;
    startWindowMove(getHwnd(win));
  });
  ipcMain.on(
    IPC_CHANNELS.NOTIFY_MAIN_CHILD_WINDOW_RESULT,
    (_event, result: MainChildWindowResult) => relayMainChildWindowResult(result)
  );
  handleIpc(
    IPC_CHANNELS.RETURN_MAIN_CHILD_WINDOW_VALUE,
    (_event, requestId: string, value: MainChildWindowReturn) =>
      setMainChildWindowReturn(requestId, value)
  );

  handleIpc(IPC_CHANNELS.LOG_PERFORMANCE_TIMING, (_event, label: string, duration: number) => {
    windowLogger.info(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
  });

  handleIpc(IPC_CHANNELS.WORKSPACE_TOGGLE_WINDOW, () => toggleWorkspaceWindow());
  handleIpc(IPC_CHANNELS.WORKSPACE_IS_OPEN, () => isWorkspaceWindowOpen());
  handleIpc(IPC_CHANNELS.WORKSPACE_HIDE_WINDOW, () => {
    hideWorkspaceWindow();
    return true;
  });

  // 編集画面の「試しに実行」は、編集画面を開いた元（ワークスペース本体または切り離しウィンドウ）を最前面にする
  handleIpc(IPC_CHANNELS.WORKSPACE_GET_ALWAYS_ON_TOP, (event) => {
    const groupId = getEditorOpenerGroupId(event.sender);
    return groupId ? getDetachedAlwaysOnTop(groupId) : getWorkspaceAlwaysOnTop();
  });
  handleIpc(IPC_CHANNELS.WORKSPACE_TOGGLE_ALWAYS_ON_TOP, (event) => {
    const groupId = getEditorOpenerGroupId(event.sender);
    return groupId ? toggleDetachedAlwaysOnTop(groupId) : toggleWorkspaceAlwaysOnTop();
  });

  // 編集は送信元（ワークスペース本体または切り離しウィンドウ）を親にした子ウィンドウで開く
  handleIpc(IPC_CHANNELS.WORKSPACE_OPEN_ITEM_EDITOR, (event, itemId: string) =>
    openWorkspaceItemEditor(event.sender, itemId)
  );

  // グループに追加するアイテムを選ぶウィンドウも、送信元を親にした子ウィンドウで開く
  handleIpc(IPC_CHANNELS.WORKSPACE_OPEN_ITEM_PICKER, (event, groupId: string) =>
    openWorkspaceItemPicker(event.sender, groupId)
  );
  // 参照の指す先を選ぶウィンドウ・一括で参照に変えるウィンドウも、送信元を親にした子ウィンドウで開く
  handleIpc(IPC_CHANNELS.WORKSPACE_OPEN_LINK_PICKER, (event, itemId: string) =>
    openWorkspaceLinkPicker(event.sender, itemId)
  );
  handleIpc(IPC_CHANNELS.WORKSPACE_OPEN_LINK_COPIES, (event, workspaceId: string) =>
    openWorkspaceLinkCopies(event.sender, workspaceId)
  );
  handleIpc(IPC_CHANNELS.WORKSPACE_OPEN_NEW_ITEM_EDITOR, (event, groupId: string) =>
    openWorkspaceNewItemEditor(event.sender, groupId)
  );

  // 確認（グループの削除・アーカイブ）も送信元を親にした子ウィンドウで開く。閉じるまで待つ
  handleIpc(IPC_CHANNELS.WORKSPACE_OPEN_CONFIRM, (event, request: ConfirmWindowRequest) =>
    openWorkspaceConfirm(event.sender, request)
  );
  handleIpc(IPC_CHANNELS.WORKSPACE_GET_CONFIRM_REQUEST, (_event, requestId: string) =>
    getWorkspaceConfirmRequest(requestId)
  );
  handleIpc(
    IPC_CHANNELS.WORKSPACE_RETURN_CONFIRM_RESULT,
    (_event, requestId: string, result: ConfirmWindowResult) =>
      setWorkspaceConfirmResult(requestId, result)
  );

  handleIpc(IPC_CHANNELS.WORKSPACE_SET_HEIGHT, (_event, height: number) => {
    const workspace = getWorkspaceWindow();
    if (!workspace || workspace.isDestroyed()) return false;

    // 幅はメインプロセスの今の値のまま。置き直した直後（幅を作業領域に収めた直後）に
    // レンダラーの古い幅で戻さないため（A3-131）
    const roundedHeight = Math.round(height);
    workspace.setBounds({ height: roundedHeight });
    windowLogger.info(`Workspace height set to ${roundedHeight}`);
    return true;
  });

  handleIpc(
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
  handleIpc(
    IPC_CHANNELS.WORKSPACE_DETACH_GROUP,
    async (_event, groupId: string, cursorX?: number, cursorY?: number) => {
      // 切り離し済みのグループをドラッグしたら、そのウィンドウをドロップした位置へ動かす
      return createDetachedGroupWindow(groupId, cursorX, cursorY, { moveExistingToCursor: true });
    }
  );

  handleIpc(IPC_CHANNELS.WORKSPACE_CLOSE_DETACHED_GROUP, (_event, groupId: string) =>
    closeDetachedGroupWindow(groupId)
  );

  handleIpc(IPC_CHANNELS.WORKSPACE_RESIZE_CALLER_WINDOW, (event, width: number, height: number) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return false;

    const { x, y } = win.getBounds();
    win.setBounds({ x, y, width: Math.round(width), height: Math.round(height) });
    rememberDetachedBoundsFromRenderer(win, { kind: 'autoFit' });

    // 中身に合わせた大きさにした後、まだ初めての表示をしていなければ、フォーカスを奪わずに出す
    // （隠れている切り離しウィンドウは、大きさを直すたびに出さない）
    if (!win.isVisible() && (!isDetachedGroupWindow(win) || takeDetachedInitialShow(win))) {
      showWithoutFocus(win);
    }

    return true;
  });

  handleIpc(
    IPC_CHANNELS.WORKSPACE_SET_CALLER_BOUNDS,
    (event, x: number, y: number, width: number, height: number) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed()) return false;

      const before = win.getBounds();
      win.setBounds({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });
      // 端のドラッグ（切り離しウィンドウだけが使う）。枠がないので resized が来ず、ここで覚える
      const after = win.getBounds();
      rememberDetachedBoundsFromRenderer(win, {
        kind: 'userResize',
        moved: after.x !== before.x || after.y !== before.y,
      });
      return true;
    }
  );

  handleIpc(
    IPC_CHANNELS.WORKSPACE_SET_POSITION_MODE,
    async (_event, mode: WorkspacePositionMode) => {
      const settingsService = await SettingsService.getInstance();
      // 左端・右端を選び直したときは、カーソルのあるディスプレイを対象にする
      // （「メインウィンドウと同じディスプレイ」に出す設定なら、そのまま残す）
      const followsMainWindow =
        (await settingsService.get('workspaceTargetDisplayIndex')) === MAIN_WINDOW_DISPLAY_INDEX;
      if ((mode === 'displayLeft' || mode === 'displayRight') && !followsMainWindow) {
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
