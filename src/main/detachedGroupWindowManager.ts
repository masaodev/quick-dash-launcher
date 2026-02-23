import * as path from 'path';

import { BrowserWindow, screen } from 'electron';
import { windowLogger } from '@common/logger';

import { EnvConfig } from './config/envConfig.js';
import PathManager from './config/pathManager.js';
import { SettingsService } from './services/settingsService.js';
import { WorkspaceService } from './services/workspace/index.js';
import { attachSnapHandler } from './utils/windowSnap.js';
import { pinWindow, unPinWindow } from './utils/virtualDesktop/index.js';

/**
 * 初回autofit前のフォールバック表示までの待機時間（ms）
 * windowManager.ts の WINDOW_FOCUS_STABILIZATION_DELAY_MS (1500ms) 以上にすること
 */
const SHOW_FALLBACK_TIMEOUT_MS = 1500;

/** 切り離しウィンドウのピンモード: 0=通常, 1=表示固定, 2=最上面固定 */
export type DetachedPinMode = 0 | 1 | 2;

/** groupId → BrowserWindow */
const detachedWindows = new Map<string, BrowserWindow>();

/** groupId → ピンモード */
const detachedPinModes = new Map<string, DetachedPinMode>();

/** webContents.id → groupId（IPC応答用の逆引き） */
const webContentsIdToGroupId = new Map<number, string>();

type Bounds = { x: number; y: number; width: number; height: number };

let isClosingAll = false;
let isDetachedWindowFocused = false;
let detachedWindowSnapEnabled: boolean = true;

/** メインウィンドウ・ワークスペースウィンドウの状態チェック用コールバック（循環依存回避） */
function applyVirtualDesktopPinToWindow(win: BrowserWindow, enabled: boolean): void {
  if (win.isDestroyed()) return;
  const hwnd = win.getNativeWindowHandle().readBigUInt64LE();
  const success = enabled ? pinWindow(hwnd) : unPinWindow(hwnd);
  const action = enabled ? 'pin' : 'unpin';
  if (success) {
    windowLogger.info(`切り離しウィンドウの仮想デスクトップ固定: ${action}`);
  } else {
    windowLogger.warn(`切り離しウィンドウの仮想デスクトップ固定に失敗: ${action}`);
  }
}

let isMainWindowVisibleFn: (() => boolean) | null = null;
let isWorkspaceWindowFocusedFn: (() => boolean) | null = null;

/**
 * 管理ウィンドウの状態チェック関数を注入する（循環依存回避用）
 */
export function setManagedWindowCheckers(checkers: {
  isMainWindowVisible: () => boolean;
  isWorkspaceWindowFocused: () => boolean;
}): void {
  isMainWindowVisibleFn = checkers.isMainWindowVisible;
  isWorkspaceWindowFocusedFn = checkers.isWorkspaceWindowFocused;
}

/** 切り離しウィンドウのスナップ有効/無効キャッシュを更新する */
export function setDetachedWindowSnapEnabled(enabled: boolean): void {
  detachedWindowSnapEnabled = enabled;
}

/**
 * 切り離しウィンドウにフォーカスがあるかどうかを返す
 */
export function getIsDetachedWindowFocused(): boolean {
  return isDetachedWindowFocused;
}

/**
 * 指定グループの切り離しウィンドウのピンモードを取得する
 */
export function getDetachedPinMode(groupId: string): DetachedPinMode {
  return detachedPinModes.get(groupId) ?? 0;
}

/**
 * 指定グループの切り離しウィンドウのピンモードをサイクルする
 * 0 → 1 → 2 → 0
 */
export function cycleDetachedPinMode(groupId: string): DetachedPinMode {
  const current = detachedPinModes.get(groupId) ?? 0;
  const next = ((current + 1) % 3) as DetachedPinMode;
  detachedPinModes.set(groupId, next);

  const win = detachedWindows.get(groupId);
  if (win && !win.isDestroyed()) {
    win.setAlwaysOnTop(next === 2);
    // setAlwaysOnTop が仮想デスクトップ固定をリセットするため再適用
    SettingsService.getInstance()
      .then((ss) => ss.get('detachedVisibleOnAllDesktops'))
      .then((enabled) => applyVirtualDesktopPinToWindow(win, enabled))
      .catch(() => {});
  }
  return next;
}

/** フォーカスを奪わずにウィンドウを前面に表示する */
export function showWithoutFocus(win: BrowserWindow): void {
  win.showInactive();
  win.moveTop();
}

/**
 * 保存された bounds が画面内に収まるか検証する
 */
function isBoundsOnScreen(bounds: Bounds): boolean {
  const displays = screen.getAllDisplays();
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  return displays.some((display) => {
    const { x, y, width, height } = display.workArea;
    return cx >= x && cx < x + width && cy >= y && cy < y + height;
  });
}

/**
 * ウィンドウの初期位置を決定する
 * 優先順位: 保存済み位置 > カーソル位置近辺 > OS既定
 */
function resolveInitialPosition(
  savedBounds: Bounds | null,
  cursorX?: number,
  cursorY?: number,
  windowWidth?: number,
  windowHeight?: number
): { x: number; y: number } | undefined {
  if (savedBounds && isBoundsOnScreen(savedBounds)) {
    return { x: savedBounds.x, y: savedBounds.y };
  }
  const w = windowWidth ?? 380;
  const h = windowHeight ?? 200;
  if (cursorX !== undefined && cursorY !== undefined) {
    return {
      x: Math.max(0, Math.round(cursorX - w / 2)),
      y: Math.max(0, Math.round(cursorY - h / 4)),
    };
  }
  // フォールバック: プライマリモニターの中央に配置
  const primary = screen.getPrimaryDisplay();
  const { x, y, width, height } = primary.workArea;
  return {
    x: Math.round(x + (width - w) / 2),
    y: Math.round(y + (height - h) / 2),
  };
}

/**
 * 切り離しグループウィンドウを作成する（既存ならフォーカスのみ）
 * @param options.skipFocus trueの場合、フォーカスを奪わずに表示する
 */
export async function createDetachedGroupWindow(
  groupId: string,
  cursorX?: number,
  cursorY?: number,
  options?: { skipFocus?: boolean }
): Promise<{ success: boolean }> {
  const existing = detachedWindows.get(groupId);
  if (existing && !existing.isDestroyed()) {
    if (options?.skipFocus) {
      showWithoutFocus(existing);
    } else {
      existing.focus();
    }
    return { success: true };
  }

  const defaultWidth = 380;
  const defaultHeight = 200;

  // スナップ設定キャッシュの初期化
  try {
    const settingsService = await SettingsService.getInstance();
    detachedWindowSnapEnabled = await settingsService.get('windowSnapEnabled');
  } catch {
    // デフォルト値(true)のまま
  }

  // 保存済み状態の読み込みを試行
  let savedBounds: Bounds | null = null;
  let savedPinMode: DetachedPinMode = 0;
  try {
    const workspaceService = await WorkspaceService.getInstance();
    const state = await workspaceService.loadDetachedWindowState(groupId);
    if (state?.bounds && state.bounds.width > 0 && state.bounds.height > 0) {
      savedBounds = state.bounds;
    }
    if (state?.pinMode === 1 || state?.pinMode === 2) {
      savedPinMode = state.pinMode;
    }
  } catch (error) {
    windowLogger.warn({ error, groupId }, '切り離しウィンドウの保存済み状態読み込みに失敗');
  }

  const width = savedBounds?.width ?? defaultWidth;
  const height = savedBounds?.height ?? defaultHeight;
  const position = resolveInitialPosition(savedBounds, cursorX, cursorY, width, height);

  const win = new BrowserWindow({
    width,
    height,
    ...(position && { x: position.x, y: position.y }),
    minWidth: 100,
    minHeight: 40,
    frame: false,
    resizable: true,
    transparent: true,
    alwaysOnTop: savedPinMode === 2,
    show: false,
    icon: PathManager.getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const queryParam = `?groupId=${encodeURIComponent(groupId)}`;
  if (EnvConfig.isDevelopment) {
    win.loadURL(`${EnvConfig.devServerUrl}/workspace.html${queryParam}`);
  } else {
    win.loadFile(path.join(__dirname, '../workspace.html'), {
      search: queryParam,
    });
  }

  win.setMenuBarVisibility(false);
  win.setMenu(null);

  detachedWindows.set(groupId, win);
  detachedPinModes.set(groupId, savedPinMode);
  // closed イベント内で webContents にアクセスできないため事前に保存
  const wcId = win.webContents.id;
  webContentsIdToGroupId.set(wcId, groupId);

  const showFallback = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      if (options?.skipFocus) {
        showWithoutFocus(win);
      } else {
        win.show();
      }
    }
  }, SHOW_FALLBACK_TIMEOUT_MS);

  // bounds 保存用のデバウンスタイマー
  let boundsTimer: ReturnType<typeof setTimeout> | null = null;
  const saveBoundsDebounced = () => {
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(async () => {
      if (win.isDestroyed()) return;
      const bounds = win.getBounds();
      try {
        const ws = await WorkspaceService.getInstance();
        await ws.saveDetachedBounds(groupId, bounds);
      } catch (error) {
        windowLogger.warn({ error, groupId }, '切り離しウィンドウの bounds 保存に失敗');
      }
    }, 300);
  };

  win.on('moved', saveBoundsDebounced);
  win.on('resized', saveBoundsDebounced);

  // フォーカス追跡（連動表示/非表示用）
  win.on('focus', () => {
    isDetachedWindowFocused = true;
  });
  win.on('blur', () => {
    isDetachedWindowFocused = false;
    hideDetachedWindowsAfterOwnBlur();
  });

  win.on('closed', () => {
    clearTimeout(showFallback);
    if (boundsTimer) clearTimeout(boundsTimer);
    webContentsIdToGroupId.delete(wcId);
    detachedWindows.delete(groupId);
    detachedPinModes.delete(groupId);
    // 明示的に閉じた場合はエントリごと削除（アプリ終了時は残す）
    if (!isClosingAll) {
      WorkspaceService.getInstance()
        .then((ws) => ws.removeDetachedWindowState(groupId))
        .catch((error) => {
          windowLogger.warn({ error, groupId }, '切り離しウィンドウ状態の削除に失敗');
        });
    }
    windowLogger.info(`切り離しウィンドウを閉じました: ${groupId}`);
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      event.preventDefault();
    }
    if (
      EnvConfig.isDevelopment &&
      input.type === 'keyDown' &&
      input.control &&
      input.shift &&
      input.key.toLowerCase() === 'i'
    ) {
      win.webContents.toggleDevTools();
    }
  });

  attachSnapHandler(win, () => detachedWindowSnapEnabled);

  // 仮想デスクトップ固定の適用（ウィンドウ表示後に実行する必要がある）
  win.once('show', () => {
    SettingsService.getInstance()
      .then((ss) => ss.get('detachedVisibleOnAllDesktops'))
      .then((enabled) => applyVirtualDesktopPinToWindow(win, enabled))
      .catch(() => {
        // デフォルトは固定なし
      });
  });

  // エントリの存在を確保（復元対象として認識されるように初期 bounds を保存）
  const initialBounds = win.getBounds();
  WorkspaceService.getInstance()
    .then((ws) => ws.saveDetachedBounds(groupId, initialBounds))
    .catch((error) => {
      windowLogger.warn({ error, groupId }, '切り離しウィンドウの初期 bounds 保存に失敗');
    });

  windowLogger.info(`切り離しウィンドウを作成しました: ${groupId}`);
  return { success: true };
}

function destroyWindowIfAlive(groupId: string): void {
  const win = detachedWindows.get(groupId);
  if (win && !win.isDestroyed()) {
    // closed イベントに頼らず明示的にマップから削除
    const wcId = win.webContents?.id;
    if (wcId !== undefined) {
      webContentsIdToGroupId.delete(wcId);
    }
    detachedWindows.delete(groupId);
    detachedPinModes.delete(groupId);
    win.destroy();
    windowLogger.info(`切り離しウィンドウを破棄しました: ${groupId}`);
  }
}

/**
 * 指定グループの切り離しウィンドウを閉じる
 */
export function closeDetachedGroupWindow(groupId: string): { success: boolean } {
  destroyWindowIfAlive(groupId);
  return { success: true };
}

/**
 * アプリ終了フラグを設定する（before-quit で呼ぶ）
 * これにより closed イベントでエントリが削除されるのを防ぐ
 */
export function setDetachedAppQuitting(quitting: boolean): void {
  isClosingAll = quitting;
}

/**
 * 切り離しウィンドウのblur後に連動非表示を判定する
 * 50ms後にチェックし、どの管理ウィンドウにもフォーカスがなければ全非表示
 */
function hideDetachedWindowsAfterOwnBlur(): void {
  setTimeout(async () => {
    if (isDetachedWindowFocused) return;
    try {
      const settingsService = await SettingsService.getInstance();
      const hideWithMain = await settingsService.get('hideDetachedWithMainWindow');
      if (!hideWithMain) return;
      if (isMainWindowVisibleFn?.()) return;
      if (isWorkspaceWindowFocusedFn?.()) return;
      hideAllDetachedGroupWindows();
    } catch (error) {
      windowLogger.warn({ error }, '切り離しウィンドウblur時の連動非表示チェックに失敗');
    }
  }, 50);
}

/**
 * すべての切り離しウィンドウを非表示にする（hide）
 * ピンモード 1以上（表示固定/最上面固定）のウィンドウはスキップする
 */
export function hideAllDetachedGroupWindows(): { success: boolean } {
  for (const [groupId, win] of detachedWindows.entries()) {
    if (!win.isDestroyed() && (detachedPinModes.get(groupId) ?? 0) === 0) {
      win.hide();
    }
  }
  return { success: true };
}

/**
 * すべての切り離しウィンドウを再表示する（フォーカスを奪わない）
 * ピンモード 1以上のウィンドウは既に表示されているためスキップする
 */
export function showAllDetachedGroupWindows(): { success: boolean } {
  for (const [groupId, win] of detachedWindows.entries()) {
    if (!win.isDestroyed() && (detachedPinModes.get(groupId) ?? 0) === 0) {
      showWithoutFocus(win);
    }
  }
  return { success: true };
}

/**
 * すべての切り離しウィンドウを閉じる（アプリ終了時用）
 */
export function closeAllDetachedGroupWindows(): void {
  for (const groupId of detachedWindows.keys()) {
    destroyWindowIfAlive(groupId);
  }
  detachedWindows.clear();
  webContentsIdToGroupId.clear();
}

/**
 * webContents.id からグループIDを逆引きする
 */
export function getGroupIdByWebContentsId(id: number): string | undefined {
  return webContentsIdToGroupId.get(id);
}

/**
 * 前回開いていた切り離しウィンドウを復元する（存在するグループのみ）
 * @param options.skipFocus trueの場合、フォーカスを奪わずに表示する
 */
/**
 * 全切り離しウィンドウに仮想デスクトップ固定設定を一括適用する
 */
export async function applyDetachedVisibilityOnAllDesktops(): Promise<void> {
  const settingsService = await SettingsService.getInstance();
  const enabled = await settingsService.get('detachedVisibleOnAllDesktops');
  for (const [, win] of detachedWindows) {
    applyVirtualDesktopPinToWindow(win, enabled);
  }
}

export async function restoreDetachedWindows(options?: { skipFocus?: boolean }): Promise<void> {
  try {
    const workspaceService = await WorkspaceService.getInstance();
    const openGroupIds = await workspaceService.loadOpenDetachedGroupIds();
    if (openGroupIds.length === 0) return;

    const groups = await workspaceService.loadGroups();
    const existingGroupIds = new Set(groups.map((g) => g.id));

    for (const groupId of openGroupIds) {
      if (existingGroupIds.has(groupId)) {
        await createDetachedGroupWindow(groupId, undefined, undefined, options);
      } else {
        // 存在しないグループのエントリを削除
        await workspaceService.removeDetachedWindowState(groupId);
      }
    }

    windowLogger.info(
      `切り離しウィンドウを復元しました: ${openGroupIds.length}件中${openGroupIds.filter((id) => existingGroupIds.has(id)).length}件`
    );
  } catch (error) {
    windowLogger.error({ error }, '切り離しウィンドウの復元に失敗しました');
  }
}
