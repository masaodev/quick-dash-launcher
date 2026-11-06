import * as path from 'path';

import { BrowserWindow } from 'electron';
import { windowLogger } from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';
import type { AdminTab } from '@common/types';

import { EnvConfig } from './config/envConfig.js';
import PathManager from './config/pathManager.js';
import { SettingsService } from './services/settingsService.js';
import { mainI18n } from './services/mainI18n.js';
import { registerChildWindowOpener } from './services/childWindowService.js';
import { WindowIdleDestroyer } from './utils/windowIdleDestroyer.js';
import {
  DEFAULT_WEB_PREFERENCES,
  attachCommonKeyHandlers,
  isAppQuitting,
} from './utils/managedWindow.js';

type ImportModalType = 'bookmark' | 'app';

const IDLE_DESTROY_MS = 5 * 60 * 1000;

let adminWindow: BrowserWindow | null = null;
let isAdminWindowVisible = false;
let initialTab: AdminTab = 'settings';
let pendingImportModal: ImportModalType | null = null;
/** アイテム管理で見せる行の id（ウィンドウを作った直後に、レンダラーが getPendingRevealItem で受け取る） */
let pendingRevealItem: string | null = null;
/**
 * ランチャーの取込の入口で、隠れていた管理ウィンドウを開いたときだけ持つ。隠したらランチャーを出す（A3-237）。
 * savedFile は、その間に取り込んで保存したデータファイル（ランチャーでそのタブを選ぶ。保存しなければ null）
 */
let returnToMain: { savedFile: string | null } | null = null;
let returnToMainHandler: ((savedFile: string | null) => void) | null = null;

/** アイテム管理に未保存の変更があるか（レンダラーが SET_ADMIN_UNSAVED で知らせる） */
let adminHasUnsavedChanges = false;

// 閉じた後も非表示で常駐するウィンドウを、放置が続いた場合のみ破棄して
// レンダラープロセスを解放する（次回表示時に再作成される）。
// 未保存の変更があるときは破棄しない（Ctrl+E で隠したときは確認が出ないので、黙って消えてしまう。A3-258）
const idleDestroyer = new WindowIdleDestroyer(IDLE_DESTROY_MS, () => {
  if (isWindowValid() && !adminWindow!.isVisible() && !adminHasUnsavedChanges) {
    closeAdminWindow();
  }
});

/** アイテム管理の未保存の変更の有無を受け取る。隠れている間に保存・破棄されて無くなったら、改めて放置の破棄を待つ */
export function setAdminHasUnsavedChanges(unsaved: boolean): void {
  const wasUnsaved = adminHasUnsavedChanges;
  adminHasUnsavedChanges = unsaved;
  if (wasUnsaved && !unsaved && isWindowValid() && !adminWindow!.isVisible()) {
    idleDestroyer.schedule();
  }
}

/**
 * ウィンドウが有効かどうかを判定する
 */
function isWindowValid(): boolean {
  return adminWindow !== null && !adminWindow.isDestroyed();
}

/**
 * 管理ウィンドウを作成し、初期設定を行う
 */
export async function createAdminWindow(): Promise<BrowserWindow> {
  if (isWindowValid()) {
    adminWindow!.show();
    adminWindow!.focus();
    return adminWindow!;
  }

  const settingsService = await SettingsService.getInstance();
  const editWidth = await settingsService.get('editModeWidth');
  const editHeight = await settingsService.get('editModeHeight');

  adminWindow = new BrowserWindow({
    width: editWidth,
    height: editHeight,
    center: true,
    alwaysOnTop: false,
    frame: true,
    autoHideMenuBar: true,
    show: false,
    title: mainI18n.t('admin.windowTitle'),
    icon: PathManager.getAppIconPath(),
    webPreferences: DEFAULT_WEB_PREFERENCES,
  });

  if (EnvConfig.isDevelopment) {
    adminWindow.loadURL(`${EnvConfig.devServerUrl}/admin.html`);
  } else {
    adminWindow.loadFile(path.join(__dirname, '../admin.html'));
  }

  adminWindow.setMenuBarVisibility(false);
  adminWindow.setMenu(null);

  // 詳細編集（アイテムの登録・編集フォーム）はこのレンダラーから window.open で開き、プロセスを共有する
  registerChildWindowOpener('admin', adminWindow.webContents);

  // 閉じる操作は隠すだけ（アプリ終了時は実際に閉じる）。未保存の変更があれば閉じる前に確認したいので、
  // 画面が動いているときはレンダラーに知らせ、閉じてよければ HIDE_EDIT_WINDOW で隠してもらう
  adminWindow.on('close', (event) => {
    if (isAppQuitting()) return;
    event.preventDefault();
    const win = adminWindow;
    if (!win || win.isDestroyed()) return;
    if (win.webContents.isDestroyed() || win.webContents.isLoading()) {
      win.hide();
      isAdminWindowVisible = false;
      return;
    }
    win.webContents.send(IPC_CHANNELS.EVENT_ADMIN_CLOSE_REQUESTED);
  });

  adminWindow.on('closed', () => {
    adminWindow = null;
    isAdminWindowVisible = false;
    adminHasUnsavedChanges = false;
    returnToMain = null;
    idleDestroyer.cancel();
  });

  adminWindow.on('show', () => {
    isAdminWindowVisible = true;
    idleDestroyer.cancel();
  });
  adminWindow.on('hide', () => {
    isAdminWindowVisible = false;
    idleDestroyer.schedule();
    // ランチャーの取込の入口から開いていたら、閉じた後に何も残らないのでランチャーへ戻す（A3-237）
    if (returnToMain && !isAppQuitting()) {
      const { savedFile } = returnToMain;
      returnToMain = null;
      returnToMainHandler?.(savedFile);
    }
  });

  attachCommonKeyHandlers(adminWindow);

  windowLogger.info('管理ウィンドウを作成しました');
  return adminWindow;
}

/** 管理ウィンドウ（なければ null） */
export function getAdminWindow(): BrowserWindow | null {
  return isWindowValid() ? adminWindow : null;
}

/**
 * 管理ウィンドウを表示する
 */
export async function showAdminWindow(): Promise<void> {
  try {
    if (!isWindowValid()) {
      await createAdminWindow();
    }
    if (adminWindow) {
      adminWindow.show();
      adminWindow.focus();
      windowLogger.info('管理ウィンドウを表示しました');
    }
  } catch (error) {
    windowLogger.error({ error }, '管理ウィンドウの表示に失敗しました');
  }
}

/**
 * 指定されたタブで管理ウィンドウを表示する
 */
export async function showAdminWindowWithTab(tab: AdminTab): Promise<void> {
  initialTab = tab;
  await showAdminWindow();

  if (isWindowValid()) {
    adminWindow!.webContents.send(IPC_CHANNELS.EVENT_SET_ACTIVE_TAB, tab);
    adminWindow!.webContents.send(IPC_CHANNELS.EVENT_WINDOW_SHOWN);
  }
}

/**
 * 指定されたインポートモーダルを開いた状態で管理ウィンドウを表示する
 *
 * ウィンドウの状態に応じて2つの経路でモーダル表示を通知する:
 * - 既存ウィンドウ: EVENT_OPEN_IMPORT_MODAL イベントで即座に通知
 * - 新規作成: pendingImportModal に保存し、レンダラー初期化時に getPendingImportModal で取得
 *   （新規作成直後はレンダラーのロードが未完了のため webContents.send が届かない）
 */
export async function showAdminWindowWithImportModal(modal: ImportModalType): Promise<void> {
  const existed = isWindowValid();
  // 前から開いていたなら、その人は管理ウィンドウを自分で使っていたので、閉じてもランチャーは出さない（A3-237）
  const wasVisible = existed && adminWindow!.isVisible();
  pendingImportModal = modal;
  await showAdminWindowWithTab('edit');
  // 開けたときだけ印を付ける（作るのに失敗したまま残ると、別の経路で開いて閉じたときにランチャーが出てしまう）
  if (!wasVisible && isWindowValid() && adminWindow!.isVisible())
    returnToMain = { savedFile: null };

  // 既存ウィンドウの場合のみイベントで即座に通知（新規作成時はレンダラー初期化時にpendingImportModalから取得）
  if (existed && isWindowValid()) {
    adminWindow!.webContents.send(IPC_CHANNELS.EVENT_OPEN_IMPORT_MODAL, modal);
  }
}

/**
 * ランチャーの取込の入口から開いた管理ウィンドウを隠したときの処理を登録する（ランチャーを出す。A3-237）
 * windowManager を直接読むと循環するので、IPC の登録側から渡す
 */
export function setReturnToMainHandler(handler: (savedFile: string | null) => void): void {
  returnToMainHandler = handler;
}

/**
 * アイテム管理で、取り込んだ分を保存した（同期のルールでの取込はその場で保存される）。
 * ランチャーの取込の入口から開いていたら、閉じたときにランチャーでこのデータファイルのタブを選ぶ（A3-237）
 */
export function notifyImportSaved(fileName: string): void {
  if (returnToMain) returnToMain.savedFile = fileName;
}

/**
 * アイテム管理を開いて、指定した id の行へスクロールして選ぶ（ランチャーの WSグループの行の F2）
 *
 * 届け方はインポートモーダルと同じ。既存のウィンドウにはイベントで、新しく作るウィンドウには
 * pendingRevealItem に置いてレンダラーの初期化時に渡す
 */
export async function showAdminWindowWithItem(itemId: string): Promise<void> {
  const existed = isWindowValid();
  pendingRevealItem = existed ? null : itemId;
  await showAdminWindowWithTab('edit');

  if (existed && isWindowValid()) {
    adminWindow!.webContents.send(IPC_CHANNELS.EVENT_REVEAL_ITEM, itemId);
  }
}

/**
 * 管理ウィンドウを非表示にする
 */
export function hideAdminWindow(): void {
  if (isWindowValid()) {
    adminWindow!.hide();
    // 隠すだけなので画面の状態は残る。開いていた取込画面を閉じさせる（次に開いたとき残らないように。A3-187）
    adminWindow!.webContents.send(IPC_CHANNELS.EVENT_ADMIN_HIDDEN);
    initialTab = 'settings';
    windowLogger.info('管理ウィンドウを非表示にしました');
  }
}

/**
 * 管理ウィンドウを完全に閉じる（アプリケーション終了時に使用）
 */
export function closeAdminWindow(): void {
  if (isWindowValid()) {
    adminWindow!.destroy();
    adminWindow = null;
    isAdminWindowVisible = false;
    windowLogger.info('管理ウィンドウを閉じました');
  }
}

/**
 * 管理ウィンドウの表示状態を切り替える
 */
export async function toggleAdminWindow(): Promise<void> {
  if (isAdminWindowVisible) {
    hideAdminWindow();
  } else {
    await showAdminWindow();
  }
}

/**
 * 初期表示タブを取得する
 */
export function getInitialTab(): AdminTab {
  return initialTab;
}

/**
 * 保留中のインポートモーダルを取得する（取得後にクリア）
 */
export function getPendingImportModal(): ImportModalType | null {
  const modal = pendingImportModal;
  pendingImportModal = null;
  return modal;
}

/**
 * 保留中の、アイテム管理で見せる行の id を取得する（取得後にクリア）
 */
export function getPendingRevealItem(): string | null {
  const itemId = pendingRevealItem;
  pendingRevealItem = null;
  return itemId;
}
