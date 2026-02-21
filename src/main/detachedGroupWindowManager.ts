import * as path from 'path';

import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import { windowLogger } from '@common/logger';

import { EnvConfig } from './config/envConfig.js';
import PathManager from './config/pathManager.js';

/** 初回autofit前のフォールバック表示までの待機時間（ms） */
const SHOW_FALLBACK_TIMEOUT_MS = 1000;

/** groupId → BrowserWindow */
const detachedWindows = new Map<string, BrowserWindow>();

/** webContents.id → groupId（IPC応答用の逆引き） */
const webContentsIdToGroupId = new Map<number, string>();

/**
 * 切り離しグループウィンドウを作成する
 * 同じgroupIdのウィンドウが既存ならフォーカスのみ行う
 */
export function createDetachedGroupWindow(
  groupId: string,
  cursorX?: number,
  cursorY?: number
): { success: boolean } {
  const existing = detachedWindows.get(groupId);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return { success: true };
  }

  const windowWidth = 380;
  const windowHeight = 200;

  const windowOptions: BrowserWindowConstructorOptions = {
    width: windowWidth,
    height: windowHeight,
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
  };

  // カーソル位置が指定されている場合、その付近にウィンドウを配置
  if (cursorX !== undefined && cursorY !== undefined) {
    windowOptions.x = Math.max(0, Math.round(cursorX - windowWidth / 2));
    windowOptions.y = Math.max(0, Math.round(cursorY - windowHeight / 4));
  }

  const win = new BrowserWindow(windowOptions);

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

  win.on('closed', () => {
    clearTimeout(showFallback);
    webContentsIdToGroupId.delete(wcId);
    detachedWindows.delete(groupId);
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

  windowLogger.info(`切り離しウィンドウを作成しました: ${groupId}`);
  return { success: true };
}

/**
 * 指定グループの切り離しウィンドウを閉じる
 */
export function closeDetachedGroupWindow(groupId: string): { success: boolean } {
  const win = detachedWindows.get(groupId);
  if (win && !win.isDestroyed()) {
    win.destroy();
    windowLogger.info(`切り離しウィンドウを破棄しました: ${groupId}`);
  }
  return { success: true };
}

/**
 * すべての切り離しウィンドウを閉じる（アプリ終了時用）
 */
export function closeAllDetachedGroupWindows(): void {
  for (const [groupId, win] of detachedWindows) {
    if (!win.isDestroyed()) {
      win.destroy();
      windowLogger.info(`切り離しウィンドウを破棄しました: ${groupId}`);
    }
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
