import { Menu, MenuItem } from 'electron';
import type { WebContents } from 'electron';
import logger from '@common/logger';
import type { WorkspaceItem } from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { mainI18n } from '../services/mainI18n.js';
import { showToastWindow } from '../services/overlayWindowService.js';
import { SettingsService } from '../services/settingsService.js';
import {
  convertRefToCopy,
  ensureMainItemIndex,
  moveWorkspaceItemToMain,
} from '../services/workspace/workspaceRefOperations.js';
import { getMainWindow, showMainWindow } from '../windowManager.js';
import { openWorkspaceLinkPicker } from '../workspaceLinkWindowManager.js';

import { notifyWorkspaceChanged } from './notifications.js';

/**
 * ワークスペースのアイテムの右クリックのうち、参照アイテムに関わる項目
 *
 * - 参照: 編集はメインウィンドウの編集画面で行う。「コピーにする」「別のアイテムを指す」を出す
 * - 元が見つからない参照: 「別のアイテムを指す」だけ（中身が無いので編集・パスの項目は出さない）
 * - コピー: 「メインウィンドウへ移して参照にする」を出す
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
    });
  }
}

/**
 * ワークスペースのアイテムをメインウィンドウへ移して参照に変え、知らせる（右クリック・メインウィンドウへのドロップ）
 *
 * @param file - 移す先のデータファイル（無ければ先頭のタブの先頭のファイル）
 * @returns 移せたか
 */
export async function moveItemToMain(id: string, file?: string): Promise<boolean> {
  try {
    const result = await moveWorkspaceItemToMain(id, file);
    notifyWorkspaceChanged();
    const name = result.item.displayName;
    await showToastWindow({
      message: result.reused
        ? result.tabName !== undefined
          ? t('workspace.ref.linkedToSameInMain', { name, tab: result.tabName })
          : t('workspace.ref.linkedToSameInMainNoTab', { name })
        : result.tabName !== undefined
          ? t('workspace.ref.movedToMain', { name, tab: result.tabName })
          : t('workspace.ref.movedToMainNoTab', { name }),
      type: 'success',
    });
    return true;
  } catch (error) {
    logger.error({ error, id, file }, 'メインウィンドウへ移せませんでした');
    await showToastWindow({
      message: t('workspaceErrors.changeFailed', {
        error: error instanceof Error ? error.message : String(error),
      }),
      type: 'error',
    });
    return false;
  }
}

/**
 * 「メインウィンドウへ移して参照にする」。移す先のタブを選ぶサブメニューにする
 * （ファイルが 2 つ以上のタブは、その下にファイルを並べる。タブが無ければ既定のファイルへ移す）
 */
export async function buildMoveToMainMenuItem(item: WorkspaceItem): Promise<MenuItem> {
  const label = t('menu.workspaceItem.moveToMain');
  const settings = await SettingsService.getInstance();
  const [tabs, labels] = await Promise.all([
    settings.get('dataFileTabs'),
    settings.get('dataFileLabels'),
  ]);
  if (tabs.length === 0) {
    return new MenuItem({ label, click: () => void moveItemToMain(item.id) });
  }
  const fileMenuItem = (fileLabel: string, file: string): MenuItem =>
    new MenuItem({ label: fileLabel, click: () => void moveItemToMain(item.id, file) });
  const submenu = new Menu();
  for (const tab of tabs) {
    if (tab.files.length <= 1) {
      submenu.append(fileMenuItem(tab.name, tab.files[0]));
      continue;
    }
    const files = new Menu();
    for (const file of tab.files) files.append(fileMenuItem(labels?.[file] || file, file));
    submenu.append(new MenuItem({ label: tab.name, submenu: files }));
  }
  return new MenuItem({ label, submenu });
}

/** 「別のアイテムを指す」（指す先を選ぶウィンドウを開く） */
function linkPickerMenuItem(sender: WebContents, item: WorkspaceItem, label: string): MenuItem {
  return new MenuItem({
    label,
    click: () => void openWorkspaceLinkPicker(sender, item.id),
  });
}

/** 参照の「コピーにする」「別のアイテムを指す」（コピーには出さない。コピーは「メインウィンドウへ移して参照にする」で参照にする） */
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
  return [];
}
