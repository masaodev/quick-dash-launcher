import { BrowserWindow } from 'electron';
import type { WebContents } from 'electron';
import {
  WORKSPACE_EDITOR_WINDOW_NAME_PREFIX,
  WORKSPACE_NEW_ITEM_WINDOW_NAME_PREFIX,
} from '@common/constants';

import { calculateEditorBounds } from './utils/editorWindowBounds.js';
import { ModalChildWindows, resolveWorkArea } from './utils/modalChildWindows.js';
import { mainI18n } from './services/mainI18n.js';

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

/** itemId（新規は "new:" ＋ groupId） → 編集ウィンドウ */
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
    title: mainI18n.t('register.editTitle'),
    bounds: calculateEditorBounds(resolveWorkArea(callerWindow)),
    // 開き元に対してモーダルにする（開き元より前に出て、閉じるまで開き元を操作させない）
    parent: callerWindow,
    logContext: { itemId },
  });
}

/**
 * グループに新しいアイテムを入力して追加するウィンドウを開く（同じグループの新規が開いていれば前面に出す）
 *
 * 中身は編集ウィンドウと同じフォームを新規の形で描く（種別を選べ、保存先はそのグループ）
 *
 * @param caller 開き元（ワークスペース本体または切り離しウィンドウ）の webContents
 * @param groupId 追加先のグループの id
 */
export async function openWorkspaceNewItemEditor(
  caller: WebContents,
  groupId: string
): Promise<void> {
  const key = `new:${groupId}`;
  if (editors.focus(key)) return;

  const callerWindow = BrowserWindow.fromWebContents(caller);
  await editors.open(key, {
    opener: 'workspace',
    name: `${WORKSPACE_NEW_ITEM_WINDOW_NAME_PREFIX}${groupId}`,
    html: 'workspace.html',
    fallbackQuery: `newItemGroupId=${encodeURIComponent(groupId)}`,
    title: mainI18n.t('workspace.edit.newTitle'),
    bounds: calculateEditorBounds(resolveWorkArea(callerWindow)),
    parent: callerWindow,
    logContext: { groupId, kind: 'new-item' },
  });
}

/** 開いている編集ウィンドウをすべて閉じる（アプリ終了時用） */
export function closeAllWorkspaceItemEditors(): void {
  editors.closeAll();
}
