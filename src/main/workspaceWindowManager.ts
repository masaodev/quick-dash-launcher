import * as path from 'path';

import { BrowserWindow, screen } from 'electron';
import { windowLogger } from '@common/logger';

let workspaceWindow: BrowserWindow | null = null;
let isWorkspaceWindowVisible: boolean = false;
let isAppQuitting: boolean = false;
let isWorkspacePinned: boolean = false;

/**
 * ワークスペースウィンドウを作成し、初期設定を行う
 * 画面右端に固定配置される縦長UIのウィンドウ
 *
 * @returns 作成されたBrowserWindowインスタンス
 * @throws Error ウィンドウの作成やコンテンツの読み込みに失敗した場合
 */
export async function createWorkspaceWindow(): Promise<BrowserWindow> {
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    // 既存のウィンドウがある場合は表示して返す
    workspaceWindow.show();
    workspaceWindow.focus();
    isWorkspaceWindowVisible = true;
    return workspaceWindow;
  }

  // 画面右端に固定配置
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 380;
  const windowHeight = screenHeight;

  workspaceWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth,
    y: 0,
    alwaysOnTop: false,
    frame: true,
    autoHideMenuBar: true,
    show: false,
    title: 'Workspace',
    icon: path.join(__dirname, '../../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ワークスペースウィンドウ用のHTMLファイルを読み込み
  if (process.env.NODE_ENV === 'development') {
    workspaceWindow.loadURL('http://localhost:9000/workspace.html');
  } else {
    workspaceWindow.loadFile(path.join(__dirname, '../workspace.html'));
  }

  // メニューバーを確実に非表示にする
  workspaceWindow.setMenuBarVisibility(false);

  // メニューを完全に削除（Altキーでも表示されないようにする）
  workspaceWindow.setMenu(null);

  workspaceWindow.on('close', (event) => {
    // アプリケーション終了時以外はウィンドウを完全に閉じずに非表示にする
    if (!isAppQuitting) {
      event.preventDefault();
      if (workspaceWindow) {
        workspaceWindow.hide();
        isWorkspaceWindowVisible = false;
      }
    }
  });

  workspaceWindow.on('closed', () => {
    workspaceWindow = null;
    isWorkspaceWindowVisible = false;
  });

  workspaceWindow.on('show', () => {
    isWorkspaceWindowVisible = true;
  });

  workspaceWindow.on('hide', () => {
    isWorkspaceWindowVisible = false;
  });

  // キーボードショートカット処理
  workspaceWindow.webContents.on('before-input-event', (event, input) => {
    // Escapeキーでの閉じる処理は無効化（誤操作防止）
    if (input.key === 'Escape' && input.type === 'keyDown') {
      event.preventDefault();
    }
    // Ctrl+Shift+I で開発者ツールを開く（開発モードのみ）
    if (
      process.env.NODE_ENV === 'development' &&
      input.type === 'keyDown' &&
      input.control &&
      input.shift &&
      input.key.toLowerCase() === 'i'
    ) {
      workspaceWindow?.webContents.toggleDevTools();
    }
  });

  windowLogger.info('ワークスペースウィンドウを作成しました');
  return workspaceWindow;
}

/**
 * ワークスペースウィンドウを表示する
 * 存在しない場合は新しく作成してから表示する
 */
export async function showWorkspaceWindow(): Promise<void> {
  try {
    if (!workspaceWindow || workspaceWindow.isDestroyed()) {
      await createWorkspaceWindow();
    }

    if (workspaceWindow) {
      workspaceWindow.show();
      workspaceWindow.focus();
      isWorkspaceWindowVisible = true;
      windowLogger.info('ワークスペースウィンドウを表示しました');
    }
  } catch (error) {
    windowLogger.error({ error }, 'ワークスペースウィンドウの表示に失敗しました');
  }
}

/**
 * ワークスペースウィンドウを非表示にする
 */
export function hideWorkspaceWindow(): void {
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    workspaceWindow.hide();
    isWorkspaceWindowVisible = false;
    windowLogger.info('ワークスペースウィンドウを非表示にしました');
  }
}

/**
 * ワークスペースウィンドウを完全に閉じる
 * アプリケーション終了時などに使用する
 */
export function closeWorkspaceWindow(): void {
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    workspaceWindow.destroy();
    workspaceWindow = null;
    isWorkspaceWindowVisible = false;
    windowLogger.info('ワークスペースウィンドウを閉じました');
  }
}

/**
 * ワークスペースウィンドウの表示状態を切り替える
 * 表示中の場合は非表示に、非表示の場合は表示にする
 */
export async function toggleWorkspaceWindow(): Promise<void> {
  if (isWorkspaceWindowVisible) {
    hideWorkspaceWindow();
  } else {
    await showWorkspaceWindow();
  }
}

/**
 * ワークスペースウィンドウの表示状態を取得する
 * @returns ワークスペースウィンドウが表示されている場合はtrue
 */
export function isWorkspaceWindowShown(): boolean {
  return isWorkspaceWindowVisible;
}

/**
 * アプリケーション終了フラグを設定する
 * @param quitting アプリケーションが終了中かどうか
 */
export function setAppQuitting(quitting: boolean): void {
  isAppQuitting = quitting;
}

/**
 * ワークスペースウィンドウのピン留め状態を設定する
 * @param isPinned - true: 最前面に固定、false: 通常モード
 */
export function setWorkspaceAlwaysOnTop(isPinned: boolean): void {
  isWorkspacePinned = isPinned;
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    workspaceWindow.setAlwaysOnTop(isPinned);
    windowLogger.info(`ワークスペースウィンドウのピン留め: ${isPinned ? 'ON' : 'OFF'}`);
  }
}

/**
 * ワークスペースウィンドウのピン留め状態をトグルする
 * @returns 新しいピン留め状態
 */
export function toggleWorkspaceAlwaysOnTop(): boolean {
  const newState = !isWorkspacePinned;
  setWorkspaceAlwaysOnTop(newState);
  return newState;
}

/**
 * ワークスペースウィンドウの現在のピン留め状態を取得する
 * @returns 現在のピン留め状態
 */
export function getWorkspaceAlwaysOnTop(): boolean {
  return isWorkspacePinned;
}
