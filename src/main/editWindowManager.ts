import * as path from 'path';

import { BrowserWindow } from 'electron';
import { windowLogger } from '@common/logger';

import { SettingsService } from './services/settingsService.js';

let editWindow: BrowserWindow | null = null;
let isEditWindowVisible: boolean = false;

/**
 * 編集ウィンドウを作成し、初期設定を行う
 * 編集専用の別ウィンドウとして、独立したコンテンツを表示する
 * メインウィンドウとは独立してフォーカス制御や表示/非表示を管理する
 *
 * @returns 作成されたBrowserWindowインスタンス
 * @throws Error ウィンドウの作成やコンテンツの読み込みに失敗した場合
 */
export async function createEditWindow(): Promise<BrowserWindow> {
  if (editWindow && !editWindow.isDestroyed()) {
    // 既存のウィンドウがある場合は表示して返す
    editWindow.show();
    editWindow.focus();
    isEditWindowVisible = true;
    return editWindow;
  }

  const settingsService = await SettingsService.getInstance();
  const editWidth = await settingsService.get('editModeWidth');
  const editHeight = await settingsService.get('editModeHeight');

  editWindow = new BrowserWindow({
    width: editWidth,
    height: editHeight,
    center: true,
    alwaysOnTop: false, // 編集ウィンドウは必ずしも最前面にしない
    frame: true, // 編集ウィンドウは通常のフレームを持つ
    show: false,
    title: 'QuickDashLauncher - 編集モード',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 編集ウィンドウ用のHTMLファイルを読み込み
  if (process.env.NODE_ENV === 'development') {
    editWindow.loadURL('http://localhost:9000/edit.html');
  } else {
    editWindow.loadFile(path.join(__dirname, '../edit.html'));
  }

  // デバッグ用：開発者ツールを開く（必要に応じてコメントアウト）
  // editWindow.webContents.openDevTools({ mode: 'detach' });

  editWindow.on('close', (event) => {
    // ウィンドウを完全に閉じずに非表示にする
    event.preventDefault();
    if (editWindow) {
      editWindow.hide();
      isEditWindowVisible = false;
    }
  });

  editWindow.on('closed', () => {
    editWindow = null;
    isEditWindowVisible = false;
  });

  editWindow.on('show', () => {
    isEditWindowVisible = true;
  });

  editWindow.on('hide', () => {
    isEditWindowVisible = false;
  });

  editWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      event.preventDefault();
      if (editWindow) {
        editWindow.hide();
        isEditWindowVisible = false;
      }
    }
  });

  windowLogger.info('編集ウィンドウを作成しました');
  return editWindow;
}

/**
 * 編集ウィンドウを表示する
 * 存在しない場合は新しく作成してから表示する
 */
export async function showEditWindow(): Promise<void> {
  try {
    if (!editWindow || editWindow.isDestroyed()) {
      await createEditWindow();
    }
    
    if (editWindow) {
      editWindow.show();
      editWindow.focus();
      isEditWindowVisible = true;
      windowLogger.info('編集ウィンドウを表示しました');
    }
  } catch (error) {
    windowLogger.error('編集ウィンドウの表示に失敗しました:', error);
  }
}

/**
 * 編集ウィンドウを非表示にする
 */
export function hideEditWindow(): void {
  if (editWindow && !editWindow.isDestroyed()) {
    editWindow.hide();
    isEditWindowVisible = false;
    windowLogger.info('編集ウィンドウを非表示にしました');
  }
}

/**
 * 編集ウィンドウを完全に閉じる
 * アプリケーション終了時などに使用する
 */
export function closeEditWindow(): void {
  if (editWindow && !editWindow.isDestroyed()) {
    editWindow.destroy();
    editWindow = null;
    isEditWindowVisible = false;
    windowLogger.info('編集ウィンドウを閉じました');
  }
}

/**
 * 編集ウィンドウの表示状態を切り替える
 * 表示中の場合は非表示に、非表示の場合は表示にする
 */
export async function toggleEditWindow(): Promise<void> {
  if (isEditWindowVisible) {
    hideEditWindow();
  } else {
    await showEditWindow();
  }
}

/**
 * 編集ウィンドウのインスタンスを取得する
 * @returns 編集ウィンドウのBrowserWindowインスタンス（存在しない場合はnull）
 */
export function getEditWindow(): BrowserWindow | null {
  return editWindow;
}

/**
 * 編集ウィンドウの表示状態を取得する
 * @returns 編集ウィンドウが表示されている場合はtrue
 */
export function isEditWindowShown(): boolean {
  return isEditWindowVisible;
}