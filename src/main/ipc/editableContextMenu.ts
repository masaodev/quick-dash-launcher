/**
 * 文字入力欄の右クリックメニュー（元に戻す・切り取り・コピー・貼り付け・すべて選択）
 *
 * Electron は入力欄を右クリックしても何も出さないので、すべての webContents の
 * context-menu イベントを拾い、入力欄（isEditable）のときだけ出す。アイテム・グループなど
 * 画面側で右クリックを受けている所は、画面側が preventDefault するのでこのイベントは来ない。
 *
 * 画面仕様: docs/screens/context-menu.md
 */
import { app, BrowserWindow, Menu, webContents as allWebContents } from 'electron';
import type { ContextMenuParams, WebContents } from 'electron';

import { t } from './contextMenuShared.js';

/** 入力欄の右クリックメニューを作る（出せる操作だけ押せる） */
export function buildEditableMenu(flags: ContextMenuParams['editFlags']): Menu {
  return Menu.buildFromTemplate([
    { role: 'undo', label: t('menu.text.undo'), enabled: flags.canUndo },
    { role: 'redo', label: t('menu.text.redo'), enabled: flags.canRedo },
    { type: 'separator' },
    { role: 'cut', label: t('menu.text.cut'), enabled: flags.canCut },
    { role: 'copy', label: t('menu.text.copy'), enabled: flags.canCopy },
    { role: 'paste', label: t('menu.text.paste'), enabled: flags.canPaste },
    { type: 'separator' },
    { role: 'selectAll', label: t('menu.text.selectAll'), enabled: flags.canSelectAll },
  ]);
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
}
