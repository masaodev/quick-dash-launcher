import * as path from 'path';

import { BrowserWindow, screen } from 'electron';
import { windowLogger } from '@common/logger';

import { EnvConfig } from './config/envConfig.js';
import PathManager from './config/pathManager.js';
import { WorkspaceService } from './services/workspace/index.js';

/** 初回autofit前のフォールバック表示までの待機時間（ms） */
const SHOW_FALLBACK_TIMEOUT_MS = 1000;

/** groupId → BrowserWindow */
const detachedWindows = new Map<string, BrowserWindow>();

/** webContents.id → groupId（IPC応答用の逆引き） */
const webContentsIdToGroupId = new Map<number, string>();

type Bounds = { x: number; y: number; width: number; height: number };

/** アプリ終了中はエントリを削除しないためのフラグ */
let isClosingAll = false;

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
  if (cursorX !== undefined && cursorY !== undefined) {
    const w = windowWidth ?? 380;
    const h = windowHeight ?? 200;
    return {
      x: Math.max(0, Math.round(cursorX - w / 2)),
      y: Math.max(0, Math.round(cursorY - h / 4)),
    };
  }
  return undefined;
}

/**
 * 切り離しグループウィンドウを作成する
 * 同じgroupIdのウィンドウが既存ならフォーカスのみ行う
 */
export async function createDetachedGroupWindow(
  groupId: string,
  cursorX?: number,
  cursorY?: number
): Promise<{ success: boolean }> {
  const existing = detachedWindows.get(groupId);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return { success: true };
  }

  const defaultWidth = 380;
  const defaultHeight = 200;

  // 保存済み bounds の読み込みを試行
  let savedBounds: Bounds | null = null;
  try {
    const workspaceService = await WorkspaceService.getInstance();
    const state = await workspaceService.loadDetachedWindowState(groupId);
    if (state?.bounds && state.bounds.width > 0 && state.bounds.height > 0) {
      savedBounds = state.bounds;
    }
  } catch {
    // 読み込み失敗時は無視
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
    alwaysOnTop: false,
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
  // closed イベント内で webContents にアクセスできないため事前に保存
  const wcId = win.webContents.id;
  webContentsIdToGroupId.set(wcId, groupId);

  const showFallback = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
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
      } catch {
        // 保存失敗は無視
      }
    }, 300);
  };

  win.on('moved', saveBoundsDebounced);
  win.on('resized', saveBoundsDebounced);

  win.on('closed', () => {
    clearTimeout(showFallback);
    if (boundsTimer) clearTimeout(boundsTimer);
    webContentsIdToGroupId.delete(wcId);
    detachedWindows.delete(groupId);
    // 明示的に閉じた場合はエントリごと削除（アプリ終了時は残す）
    if (!isClosingAll) {
      WorkspaceService.getInstance()
        .then((ws) => ws.removeDetachedWindowState(groupId))
        .catch(() => {});
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

  // エントリの存在を確保（復元対象として認識されるように初期 bounds を保存）
  const initialBounds = win.getBounds();
  WorkspaceService.getInstance()
    .then((ws) => ws.saveDetachedBounds(groupId, initialBounds))
    .catch(() => {});

  windowLogger.info(`切り離しウィンドウを作成しました: ${groupId}`);
  return { success: true };
}

function destroyWindowIfAlive(groupId: string): void {
  const win = detachedWindows.get(groupId);
  if (win && !win.isDestroyed()) {
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
 * 前回開いていた切り離しウィンドウを復元する
 * 現在のワークスペースグループに存在するもののみ復元する
 */
export async function restoreDetachedWindows(): Promise<void> {
  try {
    const workspaceService = await WorkspaceService.getInstance();
    const openGroupIds = await workspaceService.loadOpenDetachedGroupIds();
    if (openGroupIds.length === 0) return;

    const groups = await workspaceService.loadGroups();
    const existingGroupIds = new Set(groups.map((g) => g.id));

    for (const groupId of openGroupIds) {
      if (existingGroupIds.has(groupId)) {
        await createDetachedGroupWindow(groupId);
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
