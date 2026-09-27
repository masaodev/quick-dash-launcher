import { BrowserWindow } from 'electron';
import type { WebContents } from 'electron';
import { WORKSPACE_EDITOR_WINDOW_NAME_PREFIX } from '@common/constants';

import { calculateEditorBounds } from './utils/editorWindowBounds.js';
import { ModalChildWindows, resolveWorkArea } from './utils/modalChildWindows.js';

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

/** itemId → 編集ウィンドウ */
const editors = new ModalChildWindows();

/**
 * 編集ウィンドウを開く（既に同じアイテムを編集中なら前面に出す）
 *
 * @param caller 開き元（ワークスペース本体または切り離しウィンドウ）の webContents
 * @param itemId 編集するワークスペースアイテムの id
 */
export async function openWorkspaceItemEditor(caller: WebContents, itemId: string): Promise<void> {
  if (editors.focus(itemId)) return;

  const callerWindow = BrowserWindow.fromWebContents(caller);
  await editors.open(itemId, {
    opener: 'workspace',
    name: `${WORKSPACE_EDITOR_WINDOW_NAME_PREFIX}${itemId}`,
    html: 'workspace.html',
    fallbackQuery: `editItemId=${encodeURIComponent(itemId)}`,
    title: 'アイテムの編集',
    bounds: calculateEditorBounds(resolveWorkArea(callerWindow)),
    // 開き元に対してモーダルにする（開き元より前に出て、閉じるまで開き元を操作させない）
    parent: callerWindow,
    logContext: { itemId },
  });
}

/** 開いている編集ウィンドウをすべて閉じる（アプリ終了時用） */
export function closeAllWorkspaceItemEditors(): void {
  editors.closeAll();
}
