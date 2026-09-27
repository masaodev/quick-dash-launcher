import { BrowserWindow, screen } from 'electron';
import type { BrowserWindowConstructorOptions, Rectangle, WebContents } from 'electron';
import { windowLogger } from '@common/logger';
import { WORKSPACE_EDITOR_WINDOW_NAME_PREFIX } from '@common/constants';

import { DEFAULT_WEB_PREFERENCES } from './utils/managedWindow.js';
import { calculateEditorBounds } from './utils/editorWindowBounds.js';
import { getRendererHtmlUrl, openChildWindow } from './services/childWindowService.js';

/**
 * ワークスペースアイテムの編集ウィンドウ
 *
 * 以前はワークスペースウィンドウの中にモーダルを描き、ウィンドウを 850x800 に広げて
 * プライマリの右端へ動かしていた（左端配置・別ディスプレイ・固定位置で位置がずれ、
 * 切り離しウィンドウからは本体が動いた）。ここでは編集を独立した子ウィンドウで開き、
 * 開き元のウィンドウには触らない。
 *
 * 子ウィンドウはワークスペースのレンダラーから window.open で開く（レンダラープロセス共有。
 * 常駐コストはほぼ増えない）。閉じたら破棄する。同じアイテムの編集が開いていれば前面に出す。
 */

/** ready-to-show が来ないときに表示する上限（ms） */
const SHOW_FALLBACK_TIMEOUT_MS = 1500;

/** itemId → 編集ウィンドウ */
const editors = new Map<string, BrowserWindow>();

/** 開き元ウィンドウのあるディスプレイの作業領域（取れなければカーソルのあるディスプレイ） */
function resolveWorkArea(callerWindow: BrowserWindow | null): Rectangle {
  if (callerWindow && !callerWindow.isDestroyed()) {
    return screen.getDisplayMatching(callerWindow.getBounds()).workArea;
  }
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
}

function setupEditorWindow(win: BrowserWindow, itemId: string): void {
  win.setMenuBarVisibility(false);
  win.setMenu(null);
  editors.set(itemId, win);

  const showFallback = setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show();
    }
  }, SHOW_FALLBACK_TIMEOUT_MS);
  win.once('ready-to-show', () => {
    clearTimeout(showFallback);
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
    }
  });
  win.on('closed', () => {
    clearTimeout(showFallback);
    if (editors.get(itemId) === win) {
      editors.delete(itemId);
    }
  });
}

/**
 * 編集ウィンドウを開く（既に同じアイテムを編集中なら前面に出す）
 *
 * @param caller 開き元（ワークスペース本体または切り離しウィンドウ）の webContents
 * @param itemId 編集するワークスペースアイテムの id
 */
export async function openWorkspaceItemEditor(caller: WebContents, itemId: string): Promise<void> {
  const existing = editors.get(itemId);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return;
  }

  const callerWindow = BrowserWindow.fromWebContents(caller);
  const bounds = calculateEditorBounds(resolveWorkArea(callerWindow));
  const hasParent = callerWindow !== null && !callerWindow.isDestroyed();

  const options: BrowserWindowConstructorOptions = {
    ...bounds,
    title: 'アイテムの編集',
    frame: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#ffffff',
    // 開き元に対してモーダルにする（開き元より前に出て、閉じるまで開き元を操作させない）
    ...(hasParent && { parent: callerWindow, modal: true }),
    webPreferences: DEFAULT_WEB_PREFERENCES,
  };

  const name = `${WORKSPACE_EDITOR_WINDOW_NAME_PREFIX}${itemId}`;
  let win = await openChildWindow('workspace', { name, html: 'workspace.html', options });
  if (win) {
    windowLogger.info({ itemId }, '編集ウィンドウをレンダラー共有で作成しました');
  } else {
    windowLogger.warn(
      { itemId },
      'レンダラー共有での生成に失敗したため編集ウィンドウを直接生成します'
    );
    win = new BrowserWindow(options);
    void win.loadURL(
      `${getRendererHtmlUrl('workspace.html')}?editItemId=${encodeURIComponent(itemId)}`
    );
  }
  setupEditorWindow(win, itemId);
}

/** 開いている編集ウィンドウをすべて閉じる（アプリ終了時用） */
export function closeAllWorkspaceItemEditors(): void {
  for (const win of editors.values()) {
    if (!win.isDestroyed()) win.destroy();
  }
  editors.clear();
}
