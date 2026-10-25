/**
 * 文字入力欄の右クリックメニュー（元に戻す・切り取り・コピー・貼り付け・すべて選択）
 *
 * Electron は入力欄を右クリックしても何も出さないので、すべての webContents の
 * context-menu イベントを拾い、入力欄（isEditable）のときだけ出す。アイテム・グループなど
 * 画面側で右クリックを受けている所は、画面側が preventDefault するのでこのイベントは来ない。
 * メインウィンドウの検索欄も画面側で受け、検索履歴を添えて SHOW_SEARCH_BOX_CONTEXT_MENU で頼む（A3-190）。
 *
 * 画面仕様: docs/screens/context-menu.md
 */
import { app, BrowserWindow, ipcMain, Menu, webContents as allWebContents } from 'electron';
import type { MenuItemConstructorOptions, WebContents } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';
import type { SearchBoxEditFlags } from '@common/types/electronApi';

import { getValidWindow, t } from './contextMenuShared.js';

/** 「検索履歴 ▸」に並べる件数（保存は 100 件まで。それより前は Ctrl+↑ でたどる） */
const SEARCH_HISTORY_MENU_COUNT = 10;

/** 「検索履歴 ▸」の項目に出す検索語の長さの上限（長い語でメニューが広がりすぎないように） */
const SEARCH_HISTORY_LABEL_MAX = 40;

/**
 * 検索語をメニューの文言にする。Windows のメニューは「&」を次の文字の下線（アクセスキー）として扱い、
 * 「R&D」が「RD」に見えるので「&&」にする。長い語は末尾を「…」で省く（選んだときに入るのは元の語）
 */
function historyMenuLabel(query: string): string {
  const shown =
    query.length > SEARCH_HISTORY_LABEL_MAX
      ? `${query.slice(0, SEARCH_HISTORY_LABEL_MAX)}…`
      : query;
  return shown.replace(/&/g, '&&');
}

/** メニューを開いている間に画面が読み直された・閉じられたときは送らない */
function sendIfAlive(sender: WebContents, channel: string, ...args: unknown[]): void {
  if (!sender.isDestroyed()) sender.send(channel, ...args);
}

/** 入力欄の右クリックメニューの項目（出せる操作だけ押せる） */
function editableMenuTemplate(flags: SearchBoxEditFlags): MenuItemConstructorOptions[] {
  return [
    { role: 'undo', label: t('menu.text.undo'), enabled: flags.canUndo },
    { role: 'redo', label: t('menu.text.redo'), enabled: flags.canRedo },
    { type: 'separator' },
    { role: 'cut', label: t('menu.text.cut'), enabled: flags.canCut },
    { role: 'copy', label: t('menu.text.copy'), enabled: flags.canCopy },
    { role: 'paste', label: t('menu.text.paste'), enabled: flags.canPaste },
    { type: 'separator' },
    { role: 'selectAll', label: t('menu.text.selectAll'), enabled: flags.canSelectAll },
  ];
}

/** 入力欄の右クリックメニューを作る */
export function buildEditableMenu(flags: SearchBoxEditFlags): Menu {
  return Menu.buildFromTemplate(editableMenuTemplate(flags));
}

/**
 * メインウィンドウの検索欄の右クリックメニュー。文字のメニューの下に「検索履歴 ▸」を足す（A3-190）。
 * 選んだ検索語は検索欄に入れるだけ（Ctrl+↑ でたどったときと同じ）。「検索履歴を消す」は画面側で確かめてから消す
 */
export function buildSearchBoxMenu(
  flags: SearchBoxEditFlags,
  history: string[],
  sender: WebContents
): Menu {
  const recent = history.slice(0, SEARCH_HISTORY_MENU_COUNT);
  return Menu.buildFromTemplate([
    ...editableMenuTemplate(flags),
    { type: 'separator' },
    {
      label: t('menu.searchHistory.title'),
      // 履歴が無いときは押せなくする（中を開いても何も無いため）
      enabled: recent.length > 0,
      submenu: [
        ...recent.map((query): MenuItemConstructorOptions => ({
          label: historyMenuLabel(query),
          click: () => sendIfAlive(sender, IPC_CHANNELS.EVENT_SEARCH_BOX_MENU_PICK_HISTORY, query),
        })),
        { type: 'separator' },
        {
          label: t('menu.searchHistory.clear'),
          click: () => sendIfAlive(sender, IPC_CHANNELS.EVENT_SEARCH_BOX_MENU_CLEAR_HISTORY),
        },
      ],
    },
  ]);
}

/** 検索欄の右クリックメニューを出す IPC（検索欄は画面側で右クリックを受け、履歴を添えて頼む） */
export function setupSearchBoxContextMenuHandler(): void {
  ipcMain.handle(
    IPC_CHANNELS.SHOW_SEARCH_BOX_CONTEXT_MENU,
    async (event, flags: SearchBoxEditFlags, history: string[]): Promise<void> => {
      const senderWindow = getValidWindow(event);
      if (!senderWindow) return;
      buildSearchBoxMenu(flags, history, event.sender).popup({ window: senderWindow });
    }
  );
}

const attached = new WeakSet<WebContents>();

function attach(contents: WebContents): void {
  if (attached.has(contents)) return;
  attached.add(contents);
  contents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return;
    const window = BrowserWindow.fromWebContents(contents);
    if (!window || window.isDestroyed()) return;
    buildEditableMenu(params.editFlags).popup({ window });
  });
}

/** 今あるウィンドウとこれから開くウィンドウのすべてに、入力欄の右クリックメニューを付ける */
export function setupEditableContextMenu(): void {
  app.on('web-contents-created', (_event, contents) => attach(contents));
  allWebContents.getAllWebContents().forEach(attach);
  setupSearchBoxContextMenuHandler();
}
