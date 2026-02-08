import * as path from 'path';

import { BrowserWindow } from 'electron';
import { windowLogger } from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { EnvConfig } from './config/envConfig.js';
import PathManager from './config/pathManager.js';
import { SettingsService } from './services/settingsService.js';

type AdminTab = 'settings' | 'edit' | 'archive' | 'other';
type ImportModalType = 'bookmark' | 'app';

let adminWindow: BrowserWindow | null = null;
let isAdminWindowVisible = false;
let initialTab: AdminTab = 'settings';
let pendingImportModal: ImportModalType | null = null;
let isAppQuitting = false;

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
    isAdminWindowVisible = true;
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
    title: 'QuickDashLauncher - 設定・管理',
    icon: PathManager.getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (EnvConfig.isDevelopment) {
    adminWindow.loadURL(`${EnvConfig.devServerUrl}/admin.html`);
  } else {
    adminWindow.loadFile(path.join(__dirname, '../admin.html'));
  }

  adminWindow.setMenuBarVisibility(false);
  adminWindow.setMenu(null);

  adminWindow.on('close', (event) => {
    if (!isAppQuitting) {
      event.preventDefault();
      adminWindow?.hide();
      isAdminWindowVisible = false;
    }
  });

  adminWindow.on('closed', () => {
    adminWindow = null;
    isAdminWindowVisible = false;
  });

  adminWindow.on('show', () => (isAdminWindowVisible = true));
  adminWindow.on('hide', () => (isAdminWindowVisible = false));

  adminWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      event.preventDefault();
    }
    if (
      EnvConfig.isDevelopment &&
      input.type === 'keyDown' &&
      input.control &&
      input.shift &&
      input.key.toLowerCase() === 'i'
    ) {
      adminWindow?.webContents.toggleDevTools();
    }
  });

  windowLogger.info('管理ウィンドウを作成しました');
  return adminWindow;
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
    adminWindow!.webContents.send('set-active-tab', tab);
    adminWindow!.webContents.send('window-shown');
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
  const windowAlreadyExists = isWindowValid();
  pendingImportModal = modal;
  await showAdminWindowWithTab('edit');

  if (windowAlreadyExists && isWindowValid()) {
    adminWindow!.webContents.send(IPC_CHANNELS.EVENT_OPEN_IMPORT_MODAL, modal);
  }
}

/**
 * 管理ウィンドウを非表示にする
 */
export function hideAdminWindow(): void {
  if (isWindowValid()) {
    adminWindow!.hide();
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
 * 管理ウィンドウの表示状態を取得する
 */
export function isAdminWindowShown(): boolean {
  return isAdminWindowVisible;
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
 * アプリケーション終了フラグを設定する
 */
export function setAppQuitting(quitting: boolean): void {
  isAppQuitting = quitting;
}
