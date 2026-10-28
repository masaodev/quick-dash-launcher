import { BrowserWindow } from 'electron';
import type { WebContents } from 'electron';
import {
  WORKSPACE_LINK_COPIES_WINDOW_NAME_PREFIX,
  WORKSPACE_LINK_PICKER_WINDOW_NAME_PREFIX,
} from '@common/constants';

import { calculateEditorBounds } from './utils/editorWindowBounds.js';
import { ModalChildWindows, resolveWorkArea } from './utils/modalChildWindows.js';
import { mainI18n } from './services/mainI18n.js';

/**
 * 参照アイテムのためのウィンドウ（グループに追加するアイテムを選ぶウィンドウと同じ作り）
 *
 * - 指す先を選ぶ: ワークスペースの参照の右クリック「別のアイテムを指す」
 * - 一括で参照に変える: ワークスペースのタブの右クリック「メインウィンドウのアイテムとつなぐ」
 *
 * どちらもワークスペースのレンダラーから window.open で開く子ウィンドウで、開き元に対してモーダルにする
 */

/** itemId → 指す先を選ぶウィンドウ */
const linkPickers = new ModalChildWindows();
/** workspaceId → 一括で参照に変えるウィンドウ */
const linkCopies = new ModalChildWindows();

/** 指す先を選ぶウィンドウを開く（同じアイテムのものが開いていれば前面に出す） */
export async function openWorkspaceLinkPicker(caller: WebContents, itemId: string): Promise<void> {
  if (linkPickers.focus(itemId)) return;
  const callerWindow = BrowserWindow.fromWebContents(caller);
  await linkPickers.open(itemId, {
    opener: 'workspace',
    name: `${WORKSPACE_LINK_PICKER_WINDOW_NAME_PREFIX}${itemId}`,
    html: 'workspace.html',
    fallbackQuery: `linkItemId=${encodeURIComponent(itemId)}`,
    title: mainI18n.t('workspace.linkPicker.windowTitle'),
    bounds: calculateEditorBounds(resolveWorkArea(callerWindow)),
    parent: callerWindow,
    logContext: { itemId, kind: 'link-picker' },
  });
}

/** 一括で参照に変えるウィンドウを開く（同じワークスペースのものが開いていれば前面に出す） */
export async function openWorkspaceLinkCopies(
  caller: WebContents,
  workspaceId: string
): Promise<void> {
  if (linkCopies.focus(workspaceId)) return;
  const callerWindow = BrowserWindow.fromWebContents(caller);
  await linkCopies.open(workspaceId, {
    opener: 'workspace',
    name: `${WORKSPACE_LINK_COPIES_WINDOW_NAME_PREFIX}${workspaceId}`,
    html: 'workspace.html',
    fallbackQuery: `linkCopiesWorkspaceId=${encodeURIComponent(workspaceId)}`,
    title: mainI18n.t('workspace.linkCopies.title'),
    bounds: calculateEditorBounds(resolveWorkArea(callerWindow)),
    parent: callerWindow,
    logContext: { workspaceId, kind: 'link-copies' },
  });
}

/** 開いているウィンドウをすべて閉じる（アプリ終了時用） */
export function closeAllWorkspaceLinkWindows(): void {
  linkPickers.closeAll();
  linkCopies.closeAll();
}
