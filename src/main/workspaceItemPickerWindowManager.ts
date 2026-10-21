import { BrowserWindow } from 'electron';
import type { WebContents } from 'electron';
import { WORKSPACE_PICKER_WINDOW_NAME_PREFIX } from '@common/constants';

import { calculateEditorBounds } from './utils/editorWindowBounds.js';
import { ModalChildWindows, resolveWorkArea } from './utils/modalChildWindows.js';
import { mainI18n } from './services/mainI18n.js';

/**
 * グループに追加するアイテムを選ぶウィンドウ（グループの右クリック「メインウィンドウのアイテムから選ぶ」）
 *
 * 編集ウィンドウと同じく、ワークスペースのレンダラーから window.open で開く独立した子ウィンドウ。
 * ワークスペースは幅が狭いことが多く、中に一覧を出すと窮屈なので別のウィンドウにする。
 * 開き元のウィンドウには触らない。同じグループの選択が開いていれば前面に出す。
 */

/** groupId → 選ぶウィンドウ */
const pickers = new ModalChildWindows();

/**
 * 選ぶウィンドウを開く（既に同じグループの選択が開いていれば前面に出す）
 *
 * @param caller 開き元（ワークスペース本体または切り離しウィンドウ）の webContents
 * @param groupId 追加先のグループの id
 */
export async function openWorkspaceItemPicker(caller: WebContents, groupId: string): Promise<void> {
  if (pickers.focus(groupId)) return;

  const callerWindow = BrowserWindow.fromWebContents(caller);
  await pickers.open(groupId, {
    opener: 'workspace',
    name: `${WORKSPACE_PICKER_WINDOW_NAME_PREFIX}${groupId}`,
    html: 'workspace.html',
    fallbackQuery: `pickGroupId=${encodeURIComponent(groupId)}`,
    // グループ名はページが読んでから付け直す
    title: mainI18n.t('menu.workspaceGroup.addItem'),
    bounds: calculateEditorBounds(resolveWorkArea(callerWindow)),
    // 開き元に対してモーダルにする（開き元より前に出て、閉じるまで開き元を操作させない）
    parent: callerWindow,
    logContext: { groupId, kind: 'picker' },
  });
}

/** 開いている選ぶウィンドウをすべて閉じる（アプリ終了時用） */
export function closeAllWorkspaceItemPickers(): void {
  pickers.closeAll();
}
