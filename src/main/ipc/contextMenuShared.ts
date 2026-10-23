/**
 * 右クリックメニュー（ネイティブメニュー）を作る共通部品
 *
 * 画面仕様: docs/screens/context-menu.md
 */
import { BrowserWindow, Menu, MenuItem, IpcMainInvokeEvent, WebContents } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { mainI18n } from '../services/mainI18n.js';

/** メニューの文言（開くたびに作るので、今の表示言語になる） */
export const t = mainI18n.t.bind(mainI18n);

/** メニューアイテムを作成するヘルパー */
export function createMenuItem(
  label: string,
  sender: WebContents,
  channel: string,
  ...args: unknown[]
): MenuItem {
  return new MenuItem({
    label,
    click: () => sender.send(channel, ...args),
  });
}

/** セパレーターを作成 */
export function createSeparator(): MenuItem {
  return new MenuItem({ type: 'separator' });
}

/** イベントからウィンドウを取得（無効な場合はnull） */
export function getValidWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    return null;
  }
  return window;
}

/** パス系メニューの送信先チャンネル（ランチャーとワークスペースで共通の並び） */
export interface PathMenuChannels {
  copyPath: string;
  copyParentPath: string;
  openParentFolder: string;
  copyShortcutPath: string;
  copyShortcutParentPath: string;
  openShortcutParentFolder: string;
}

/** パスのコピー・親フォルダ・リンク先の各メニュー項目を追加する */
export function appendPathMenuItems(
  menu: Menu,
  sender: WebContents,
  channels: PathMenuChannels,
  arg: unknown,
  options: { hasParentFolder: boolean; isShortcut: boolean }
): void {
  menu.append(createMenuItem(t('menu.copyPath'), sender, channels.copyPath, arg));

  if (options.hasParentFolder) {
    menu.append(createMenuItem(t('menu.copyParentPath'), sender, channels.copyParentPath, arg));
    menu.append(createMenuItem(t('menu.openParentFolder'), sender, channels.openParentFolder, arg));
  }

  if (options.isShortcut) {
    menu.append(createSeparator());
    menu.append(createMenuItem(t('menu.copyShortcutPath'), sender, channels.copyShortcutPath, arg));
    menu.append(
      createMenuItem(t('menu.copyShortcutParentPath'), sender, channels.copyShortcutParentPath, arg)
    );
    menu.append(
      createMenuItem(
        t('menu.openShortcutParentFolder'),
        sender,
        channels.openShortcutParentFolder,
        arg
      )
    );
  }
}

export const LAUNCHER_PATH_MENU_CHANNELS: PathMenuChannels = {
  copyPath: IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PATH,
  copyParentPath: IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PARENT_PATH,
  openParentFolder: IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_PARENT_FOLDER,
  copyShortcutPath: IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PATH,
  copyShortcutParentPath: IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PARENT_PATH,
  openShortcutParentFolder: IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
};

export const WORKSPACE_PATH_MENU_CHANNELS: PathMenuChannels = {
  copyPath: IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_PATH,
  copyParentPath: IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_PARENT_PATH,
  openParentFolder: IPC_CHANNELS.EVENT_WORKSPACE_MENU_OPEN_PARENT_FOLDER,
  copyShortcutPath: IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PATH,
  copyShortcutParentPath: IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PARENT_PATH,
  openShortcutParentFolder: IPC_CHANNELS.EVENT_WORKSPACE_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
};
