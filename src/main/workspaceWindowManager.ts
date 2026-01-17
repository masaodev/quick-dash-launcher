import * as path from 'path';

import { BrowserWindow, screen } from 'electron';
import { windowLogger } from '@common/logger';
import type { WorkspacePositionMode } from '@common/types';

import { SettingsService } from './services/settingsService.js';
import { EnvConfig } from './config/envConfig.js';
import PathManager from './config/pathManager.js';

let workspaceWindow: BrowserWindow | null = null;
let isWorkspaceWindowVisible: boolean = false;
let isAppQuitting: boolean = false;
let isWorkspacePinned: boolean = false;
let normalWorkspaceWindowBounds: { width: number; height: number } | null = null;

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

  // 初期サイズの設定（位置は後で setWorkspacePosition() で設定）
  const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 380;
  const windowHeight = screenHeight;

  // 設定から透過度を取得
  const settingsService = await SettingsService.getInstance();
  const opacity = await settingsService.get('workspaceOpacity');
  const backgroundTransparent = await settingsService.get('workspaceBackgroundTransparent');

  // 背景のみ透過の場合はウィンドウは完全不透明、それ以外は設定値を使用
  const opacityValue = backgroundTransparent ? 1.0 : Math.max(0, Math.min(100, opacity)) / 100;

  workspaceWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    // x, y は指定しない（後で setWorkspacePosition() で設定）
    alwaysOnTop: false,
    frame: false, // フレームレスウィンドウ（ドラッグ可能にするため）
    show: false, // 位置設定後に表示
    resizable: false, // カスタムサイズ変更を使用するため無効化
    icon: PathManager.getAppIconPath(),
    transparent: true, // 透過対応を有効化
    opacity: opacityValue, // 初期透過度を設定
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ワークスペースウィンドウ用のHTMLファイルを読み込み
  if (EnvConfig.isDevelopment) {
    workspaceWindow.loadURL(`${EnvConfig.devServerUrl}/workspace.html`);
  } else {
    workspaceWindow.loadFile(path.join(__dirname, '../workspace.html'));
  }

  // メニューバーを確実に非表示にする
  workspaceWindow.setMenuBarVisibility(false);

  // メニューを完全に削除（Altキーでも表示されないようにする）
  workspaceWindow.setMenu(null);

  // 透過ウィンドウでもマウスイベントを受け取るように設定
  workspaceWindow.setIgnoreMouseEvents(false);

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
      EnvConfig.isDevelopment &&
      input.type === 'keyDown' &&
      input.control &&
      input.shift &&
      input.key.toLowerCase() === 'i'
    ) {
      workspaceWindow?.webContents.toggleDevTools();
    }
  });

  // ウィンドウ移動時に位置を保存（fixedモード時のみ）
  workspaceWindow.on('moved', () => {
    void saveWorkspacePosition();
  });

  // 位置を設定
  await setWorkspacePosition();

  windowLogger.info('ワークスペースウィンドウを作成しました');
  return workspaceWindow;
}

/**
 * ワークスペースウィンドウを表示する
 * 存在しない場合は新しく作成してから表示する
 */
export async function showWorkspaceWindow(options?: { skipFocus?: boolean }): Promise<void> {
  try {
    if (!workspaceWindow || workspaceWindow.isDestroyed()) {
      await createWorkspaceWindow();
    }

    if (workspaceWindow) {
      // 表示前に位置を設定（設定変更考慮）
      await setWorkspacePosition();

      workspaceWindow.show();
      // skipFocusオプションがtrueの場合はフォーカスしない（メイン画面のフォーカスを維持）
      if (!options?.skipFocus) {
        workspaceWindow.focus();
      }
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

/**
 * ワークスペースウィンドウのモーダルモードの切り替え
 * モーダル表示時は必要に応じてウィンドウサイズを拡大し、閉じる時は元のサイズに戻す
 */
export function setWorkspaceModalMode(
  isModal: boolean,
  requiredSize?: { width: number; height: number }
): void {
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    if (isModal && requiredSize) {
      // モーダル表示時：現在のサイズを保存し、必要な場合のみ拡大
      const currentBounds = workspaceWindow.getBounds();
      normalWorkspaceWindowBounds = { width: currentBounds.width, height: currentBounds.height };

      // 必要サイズと現在サイズを比較し、必要な場合のみ拡大
      if (currentBounds.width < requiredSize.width || currentBounds.height < requiredSize.height) {
        const newWidth = Math.max(currentBounds.width, requiredSize.width);
        const newHeight = Math.max(currentBounds.height, requiredSize.height);

        // 画面右端に固定するためにx座標を調整
        const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
        const newX = screenWidth - newWidth;

        workspaceWindow.setBounds({
          x: newX,
          y: currentBounds.y,
          width: newWidth,
          height: newHeight,
        });

        windowLogger.info(
          `モーダルモードON: サイズを${currentBounds.width}x${currentBounds.height}から${newWidth}x${newHeight}に変更`
        );
      }
    } else {
      // モーダルを閉じる時：元のサイズに復元
      if (normalWorkspaceWindowBounds) {
        const currentBounds = workspaceWindow.getBounds();

        // 画面右端に固定するためにx座標を調整
        const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
        const newX = screenWidth - normalWorkspaceWindowBounds.width;

        workspaceWindow.setBounds({
          x: newX,
          y: currentBounds.y,
          width: normalWorkspaceWindowBounds.width,
          height: normalWorkspaceWindowBounds.height,
        });

        windowLogger.info(
          `モーダルモードOFF: サイズを${normalWorkspaceWindowBounds.width}x${normalWorkspaceWindowBounds.height}に復元`
        );

        normalWorkspaceWindowBounds = null;
      }
    }
  }
}

/**
 * ワークスペースウィンドウを指定されたモードに応じた位置に配置する
 * @param mode ワークスペース表示位置モード ('primaryLeft' | 'primaryRight' | 'fixed')
 */
export async function setWorkspacePosition(mode?: WorkspacePositionMode): Promise<void> {
  if (!workspaceWindow || workspaceWindow.isDestroyed()) return;

  const settingsService = await SettingsService.getInstance();
  const positionMode = mode || (await settingsService.get('workspacePositionMode'));

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const bounds = workspaceWindow.getBounds();

  switch (positionMode) {
    case 'primaryLeft':
      workspaceWindow.setPosition(0, 0);
      workspaceWindow.setSize(bounds.width, screenHeight);
      windowLogger.info('ワークスペースをプライマリディスプレイの左端に配置');
      break;

    case 'primaryRight':
      workspaceWindow.setPosition(screenWidth - bounds.width, 0);
      workspaceWindow.setSize(bounds.width, screenHeight);
      windowLogger.info('ワークスペースをプライマリディスプレイの右端に配置');
      break;

    case 'fixed': {
      const savedX = await settingsService.get('workspacePositionX');
      const savedY = await settingsService.get('workspacePositionY');

      // 初回起動時（0,0）は右端に配置
      if (savedX === 0 && savedY === 0) {
        workspaceWindow.setPosition(screenWidth - bounds.width, 0);
        workspaceWindow.setSize(bounds.width, screenHeight);
        const newBounds = workspaceWindow.getBounds();
        await settingsService.set('workspacePositionX', newBounds.x);
        await settingsService.set('workspacePositionY', newBounds.y);
        windowLogger.info('初回起動: ワークスペースを右端に配置し位置を保存');
      } else {
        // 保存された位置が画面内にあるかチェック
        const displays = screen.getAllDisplays();
        const isOnScreen = displays.some((display) => {
          const wb = display.workArea;
          return (
            savedX >= wb.x &&
            savedX < wb.x + wb.width &&
            savedY >= wb.y &&
            savedY < wb.y + wb.height
          );
        });

        if (!isOnScreen) {
          // 画面外の場合は右端にフォールバック
          windowLogger.warn('保存位置が画面外のため右端に配置');
          workspaceWindow.setPosition(screenWidth - bounds.width, 0);
          // 新しい位置を保存
          const newBounds = workspaceWindow.getBounds();
          await settingsService.set('workspacePositionX', newBounds.x);
          await settingsService.set('workspacePositionY', newBounds.y);
        } else {
          workspaceWindow.setPosition(savedX, savedY);
          windowLogger.info(`ワークスペースを固定位置に配置: (${savedX}, ${savedY})`);
        }
      }
      break;
    }
  }
}

/**
 * 現在のワークスペースウィンドウ位置を保存する（fixedモード時のみ）
 */
export async function saveWorkspacePosition(): Promise<void> {
  if (!workspaceWindow || workspaceWindow.isDestroyed()) return;

  const settingsService = await SettingsService.getInstance();
  const positionMode = await settingsService.get('workspacePositionMode');

  if (positionMode === 'fixed') {
    const bounds = workspaceWindow.getBounds();
    await settingsService.set('workspacePositionX', bounds.x);
    await settingsService.set('workspacePositionY', bounds.y);
    windowLogger.info(`ワークスペース位置を保存: (${bounds.x}, ${bounds.y})`);
  }
}

/**
 * ワークスペースウィンドウのインスタンスを取得する
 * @returns ワークスペースウィンドウのBrowserWindowインスタンス、存在しない場合はnull
 */
export function getWorkspaceWindow(): BrowserWindow | null {
  return workspaceWindow;
}
