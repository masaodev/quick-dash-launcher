import * as path from 'path';

import { BrowserWindow } from 'electron';
import { windowLogger } from '@common/logger';

import { SettingsService } from './services/settingsService.js';

let adminWindow: BrowserWindow | null = null;
let isAdminWindowVisible: boolean = false;
let initialTab: 'settings' | 'edit' | 'other' = 'settings';

/**
 * 管理ウィンドウを作成し、初期設定を行う
 * 設定・管理専用の別ウィンドウとして、独立したコンテンツを表示する
 * メインウィンドウとは独立してフォーカス制御や表示/非表示を管理する
 *
 * @returns 作成されたBrowserWindowインスタンス
 * @throws Error ウィンドウの作成やコンテンツの読み込みに失敗した場合
 */
export async function createAdminWindow(): Promise<BrowserWindow> {
  if (adminWindow && !adminWindow.isDestroyed()) {
    // 既存のウィンドウがある場合は表示して返す
    adminWindow.show();
    adminWindow.focus();
    isAdminWindowVisible = true;
    return adminWindow;
  }

  const settingsService = await SettingsService.getInstance();
  const editWidth = await settingsService.get('editModeWidth');
  const editHeight = await settingsService.get('editModeHeight');

  adminWindow = new BrowserWindow({
    width: editWidth,
    height: editHeight,
    center: true,
    alwaysOnTop: false, // 管理ウィンドウは必ずしも最前面にしない
    frame: true, // 管理ウィンドウは通常のフレームを持つ
    show: false,
    title: 'QuickDashLauncher - 設定・管理',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 管理ウィンドウ用のHTMLファイルを読み込み
  if (process.env.NODE_ENV === 'development') {
    adminWindow.loadURL('http://localhost:9000/admin.html');
  } else {
    adminWindow.loadFile(path.join(__dirname, '../admin.html'));
  }

  // デバッグ用：開発者ツールを開く（必要に応じてコメントアウト）
  // adminWindow.webContents.openDevTools({ mode: 'detach' });

  adminWindow.on('close', (event) => {
    // ウィンドウを完全に閉じずに非表示にする
    event.preventDefault();
    if (adminWindow) {
      adminWindow.hide();
      isAdminWindowVisible = false;
    }
  });

  adminWindow.on('closed', () => {
    adminWindow = null;
    isAdminWindowVisible = false;
  });

  adminWindow.on('show', () => {
    isAdminWindowVisible = true;
  });

  adminWindow.on('hide', () => {
    isAdminWindowVisible = false;
  });

  adminWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      event.preventDefault();
      if (adminWindow) {
        adminWindow.hide();
        isAdminWindowVisible = false;
      }
    }
  });

  windowLogger.info('管理ウィンドウを作成しました');
  return adminWindow;
}

/**
 * 管理ウィンドウを表示する
 * 存在しない場合は新しく作成してから表示する
 */
export async function showAdminWindow(): Promise<void> {
  try {
    if (!adminWindow || adminWindow.isDestroyed()) {
      await createAdminWindow();
    }

    if (adminWindow) {
      adminWindow.show();
      adminWindow.focus();
      isAdminWindowVisible = true;
      windowLogger.info('管理ウィンドウを表示しました');
    }
  } catch (error) {
    windowLogger.error('管理ウィンドウの表示に失敗しました:', error);
  }
}

/**
 * 指定されたタブで管理ウィンドウを表示する
 * 存在しない場合は新しく作成してから表示する
 */
export async function showAdminWindowWithTab(tab: 'settings' | 'edit' | 'other'): Promise<void> {
  initialTab = tab;
  await showAdminWindow();

  // ウィンドウが表示された後、タブを設定するメッセージを送信
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.webContents.send('set-active-tab', tab);
  }
}

/**
 * 管理ウィンドウを非表示にする
 */
export function hideAdminWindow(): void {
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.hide();
    isAdminWindowVisible = false;
    resetInitialTab();
    windowLogger.info('管理ウィンドウを非表示にしました');
  }
}

/**
 * 管理ウィンドウを完全に閉じる
 * アプリケーション終了時などに使用する
 */
export function closeAdminWindow(): void {
  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.destroy();
    adminWindow = null;
    isAdminWindowVisible = false;
    windowLogger.info('管理ウィンドウを閉じました');
  }
}

/**
 * 管理ウィンドウの表示状態を切り替える
 * 表示中の場合は非表示に、非表示の場合は表示にする
 */
export async function toggleAdminWindow(): Promise<void> {
  if (isAdminWindowVisible) {
    hideAdminWindow();
  } else {
    await showAdminWindow();
  }
}

/**
 * 管理ウィンドウのインスタンスを取得する
 * @returns 管理ウィンドウのBrowserWindowインスタンス（存在しない場合はnull）
 */
export function getAdminWindow(): BrowserWindow | null {
  return adminWindow;
}

/**
 * 管理ウィンドウの表示状態を取得する
 * @returns 管理ウィンドウが表示されている場合はtrue
 */
export function isAdminWindowShown(): boolean {
  return isAdminWindowVisible;
}

/**
 * 初期表示タブを取得する
 * @returns 初期表示するタブ
 */
export function getInitialTab(): 'settings' | 'edit' | 'other' {
  return initialTab;
}

/**
 * 初期表示タブをリセットする
 */
export function resetInitialTab(): void {
  initialTab = 'settings';
}
