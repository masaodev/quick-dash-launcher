import { MenuItem } from 'electron';
import type { WebContents } from 'electron';
import logger from '@common/logger';
import type { WorkspaceItem } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { mainI18n } from '../services/mainI18n.js';
import { LONG_TOAST_DURATION_MS, showToastWindow } from '../services/overlayWindowService.js';
import {
  convertRefToCopy,
  ensureMainItemIndex,
} from '../services/workspace/workspaceRefOperations.js';
import { getMainWindow, showMainWindow } from '../windowManager.js';
import { openWorkspaceLinkPicker } from '../workspaceLinkWindowManager.js';

import { notifyWorkspaceChanged } from './notifications.js';

/**
 * ワークスペースのアイテムの右クリックのうち、参照アイテムに関わる項目
 *
 * - 参照: 編集はメインウィンドウの編集画面で行う。「コピーにする」「別のアイテムを指す」を出す
 * - 元が見つからない参照: 「別のアイテムを指す」だけ（中身が無いので編集・パスの項目は出さない）
 * - コピー: 「メインウィンドウのアイテムを参照する」を出す
 */

const t = mainI18n.t.bind(mainI18n);

/** 参照の指すメインウィンドウのアイテムを、メインウィンドウの編集画面で開く */
export async function editLinkedMainItem(item: WorkspaceItem): Promise<void> {
  if (!item.ref) return;
  const index = await ensureMainItemIndex();
  const main = index.byId.get(item.ref.itemId);
  if (!main) {
    await showToastWindow({ message: t('workspace.ref.editMainNotFound'), type: 'warning' });
    return;
  }
  // 編集画面はメインウィンドウを親にして開くので、先にメインウィンドウを出す
  await showMainWindow();
  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(IPC_CHANNELS.EVENT_LAUNCHER_MENU_EDIT_ITEM, main);
}

/** 参照をコピーにして知らせる */
async function convertToCopy(item: WorkspaceItem): Promise<void> {
  try {
    const converted = await convertRefToCopy(item.id);
    notifyWorkspaceChanged();
    await showToastWindow({
      message: t('workspace.ref.convertedToCopy', { name: converted.displayName }),
      type: 'success',
    });
  } catch (error) {
    logger.error({ error, id: item.id }, '参照をコピーにできませんでした');
    await showToastWindow({
      message: t('workspaceErrors.changeFailed', {
        error: error instanceof Error ? error.message : String(error),
      }),
      type: 'error',
      duration: LONG_TOAST_DURATION_MS,
    });
  }
}

/** 「別のアイテムを指す」「メインウィンドウのアイテムを参照する」（指す先を選ぶウィンドウを開く） */
function linkPickerMenuItem(sender: WebContents, item: WorkspaceItem, label: string): MenuItem {
  return new MenuItem({
    label,
    click: () => void openWorkspaceLinkPicker(sender, item.id),
  });
}

/** 参照（解決できたもの）の「コピーにする」「別のアイテムを指す」 */
export function buildRefMenuItems(sender: WebContents, item: WorkspaceItem): MenuItem[] {
  if (item.ref?.status === 'ok') {
    return [
      new MenuItem({
        label: t('menu.workspaceItem.convertToCopy'),
        click: () => void convertToCopy(item),
      }),
      linkPickerMenuItem(sender, item, t('menu.workspaceItem.retarget')),
    ];
  }
  if (item.type === 'ref') {
    return [linkPickerMenuItem(sender, item, t('menu.workspaceItem.retarget'))];
  }
  // コピー: パスの無い単一アイテムも、選べば参照にできる
  return [linkPickerMenuItem(sender, item, t('menu.workspaceItem.linkToMain'))];
}
