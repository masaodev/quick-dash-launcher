import * as path from 'path';

import {
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  app,
  shell,
  screen,
  dialog,
  Rectangle,
} from 'electron';
import { windowLogger } from '@common/logger';
import type { WindowPinMode, WindowPositionMode } from '@common/types';
import { PerformanceTimer } from '@common/utils/performanceTimer';

import { HotkeyService } from './services/hotkeyService.js';
import { SettingsService } from './services/settingsService.js';
import { showAdminWindowWithTab } from './adminWindowManager.js';
import PathManager from './config/pathManager.js';
import { EnvConfig } from './config/envConfig.js';
import { calculateModalSize } from './utils/modalSizeManager.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

let windowPinMode: WindowPinMode = EnvConfig.windowPinMode ?? 'normal';
let isEditMode: boolean = false;
let isFirstLaunchMode: boolean = false;
let isModalMode: boolean = false;
let normalWindowBounds: { width: number; height: number } | null = null;
let isShowingWindow: boolean = false; // ウィンドウ表示中フラグ（blur無視用）
let showingWindowTimeoutId: ReturnType<typeof setTimeout> | null = null;

/** フォーカスが安定するまでの猶予期間（ミリ秒） */
const WINDOW_FOCUS_STABILIZATION_DELAY_MS = 200;

/**
 * ウィンドウ表示中フラグを設定し、一定時間後に自動解除する
 * 既存のタイムアウトがあれば先にクリアする
 */
function setShowingWindowFlag(): void {
  // 既存のタイムアウトをクリア
  if (showingWindowTimeoutId !== null) {
    clearTimeout(showingWindowTimeoutId);
  }

  isShowingWindow = true;

  showingWindowTimeoutId = setTimeout(() => {
    isShowingWindow = false;
    showingWindowTimeoutId = null;
  }, WINDOW_FOCUS_STABILIZATION_DELAY_MS);
}

/**
 * ウィンドウ表示中フラグを即座にリセットする
 */
function clearShowingWindowFlag(): void {
  if (showingWindowTimeoutId !== null) {
    clearTimeout(showingWindowTimeoutId);
    showingWindowTimeoutId = null;
  }
  isShowingWindow = false;
}

/**
 * メインウィンドウを非表示にし、レンダラープロセスに通知を送る
 * window-hiddenイベントを送信してから、実際にウィンドウを非表示にする
 */
function hideMainWindowInternal(): void {
  if (!mainWindow) return;

  clearShowingWindowFlag();

  // レンダラープロセスに非表示通知を送る
  mainWindow.webContents.send('window-hidden');

  // ウィンドウを非表示にする
  mainWindow.hide();
}

/**
 * アプリケーションのメインウィンドウを作成し、初期設定を行う
 * 初期状態では通常モード（非最前面）で、フレームレスで中央に配置される
 * フォーカス喪失時の自動非表示やESCキーでの終了など、ランチャーアプリとしての動作を設定
 */
export async function createWindow(): Promise<BrowserWindow> {
  const settingsService = await SettingsService.getInstance();
  // 初回起動時は大きめのウィンドウサイズを使用
  const windowWidth = isFirstLaunchMode ? 700 : await settingsService.get('windowWidth');
  const windowHeight = isFirstLaunchMode ? 600 : await settingsService.get('windowHeight');

  // アイコンパスを取得（開発モード時は専用のアイコンを使用）
  const iconPath = PathManager.getAppIconPath();

  windowLogger.info(`アイコンパス: ${iconPath}`);
  windowLogger.info(`ファイル存在確認: ${require('fs').existsSync(iconPath)}`);

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    center: true,
    alwaysOnTop: false,
    frame: false,
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // タスクバーのアイコンを明示的に設定（Windowsで必要）
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    windowLogger.warn(`アイコンファイルが読み込めませんでした: ${iconPath}`);
  } else {
    windowLogger.info(`アイコンを設定しました: ${iconPath}`);
    mainWindow.setIcon(icon);
  }

  if (EnvConfig.isDevelopment) {
    mainWindow.loadURL(EnvConfig.devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }

  mainWindow.on('blur', () => {
    const shouldHide =
      mainWindow &&
      !mainWindow.webContents.isDevToolsOpened() &&
      windowPinMode === 'normal' &&
      !isEditMode &&
      !isFirstLaunchMode &&
      !isModalMode &&
      !isShowingWindow;

    if (shouldHide) {
      hideMainWindowInternal();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // ウィンドウ移動時に位置を保存（fixedモードの場合のみ）
  mainWindow.on('moved', () => {
    void saveWindowPosition();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      event.preventDefault();
      // 以下の場合はEscapeキーで閉じない
      // - 初回起動モード
      // - 編集モード
      // - モーダルモード
      // - ピン留めモードがalwaysOnTopまたはstayVisible
      const shouldNotHide =
        isFirstLaunchMode ||
        isEditMode ||
        isModalMode ||
        windowPinMode === 'alwaysOnTop' ||
        windowPinMode === 'stayVisible';

      if (mainWindow && !shouldNotHide) {
        hideMainWindowInternal();
      }
    }
  });

  // Enable webSecurity for file drag and drop
  mainWindow.webContents.session.webRequest.onBeforeRequest((_details, callback) => {
    callback({ cancel: false });
  });

  // 環境変数でピンモードが指定されている場合、ウィンドウ動作を更新
  if (EnvConfig.hasWindowPinMode) {
    updateWindowBehavior();
    windowLogger.info(`初期ピンモードを設定しました: ${windowPinMode}`);
  }

  return mainWindow;
}

export async function createTray(): Promise<void> {
  // アイコンパスを取得（開発モード時は専用のアイコンを使用）
  const iconPath = PathManager.getAppIconPath();
  const icon = nativeImage.createFromPath(iconPath);

  tray = new Tray(icon);

  // package.jsonからバージョンを取得
  const packageJson = await import('../../package.json');
  const version = packageJson.version || '0.0.0';

  // 設定サービスからホットキーを取得
  const settingsService = await SettingsService.getInstance();
  const hotkey = await settingsService.get('hotkey');
  const hotkeyLabel = hotkey ? ` (${hotkey})` : '';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `QuickDashLauncher v${version}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: `表示${hotkeyLabel}`,
      click: () => {
        if (mainWindow) {
          void showMainWindow();
        }
      },
    },
    {
      label: '画面中央に表示',
      click: () => {
        showWindowAtCenter();
      },
    },
    {
      label: '設定...',
      click: async () => {
        await showAdminWindowWithTab('settings');
      },
    },
    { type: 'separator' },
    {
      label: 'データフォルダを開く',
      click: async () => {
        const configFolder = PathManager.getConfigFolder();
        await shell.openPath(configFolder);
      },
    },
    { type: 'separator' },
    {
      label: 'ヘルプ',
      click: async () => {
        await shell.openExternal('https://github.com/masaodev/quick-dash-launcher');
      },
    },
    { type: 'separator' },
    {
      label: '再起動',
      click: async () => {
        if (EnvConfig.isDevelopment) {
          const result = await dialog.showMessageBox({
            type: 'warning',
            title: '再起動（開発モード）',
            message: '開発モードでは自動再起動をサポートしていません',
            detail:
              'アプリを終了後、ターミナルで以下のコマンドを実行してください：\n\n  npm run dev\n\nアプリを終了しますか？',
            buttons: ['キャンセル', '終了'],
            defaultId: 0,
            cancelId: 0,
          });
          if (result.response === 1) {
            windowLogger.info('開発モードでの終了を実行します');
            app.quit();
          }
        } else {
          windowLogger.info('本番モードでの再起動を実行します');
          app.relaunch();
          app.quit();
        }
      },
    },
    {
      label: '終了',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('QuickDashLauncher');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

export async function registerGlobalShortcut(): Promise<void> {
  try {
    const hotkeyService = HotkeyService.getInstance(
      () => mainWindow,
      showMainWindow,
      hideMainWindow
    );

    // アイテム検索モード直接起動のコールバックを設定
    hotkeyService.setItemSearchCallback(showMainWindowWithItemSearch);

    const success = await hotkeyService.registerHotkey();

    if (!success) {
      windowLogger.warn('ホットキーの登録に失敗しました');
    }
  } catch (error) {
    windowLogger.error({ error }, 'ホットキーサービスの初期化に失敗しました');
  }
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * 現在のウィンドウピンモードを取得する
 * @returns 現在のWindowPinMode
 */
export function getWindowPinMode(): WindowPinMode {
  return windowPinMode;
}

/**
 * ウィンドウピンモードを設定し、ウィンドウの動作を更新する
 * @param mode 設定するWindowPinMode
 * @internal 現在は使用されていませんが、将来の拡張のために保持
 */
export function setWindowPinMode(mode: WindowPinMode): void {
  windowPinMode = mode;
  updateWindowBehavior();
}

/**
 * 次のピンモードに循環的に切り替える
 * normal -> alwaysOnTop -> stayVisible -> normal
 * @returns 切り替え後のWindowPinMode
 */
export function cycleWindowPinMode(): WindowPinMode {
  const modes: WindowPinMode[] = ['normal', 'alwaysOnTop', 'stayVisible'];
  const currentIndex = modes.indexOf(windowPinMode);
  const nextIndex = (currentIndex + 1) % modes.length;
  const nextMode = modes[nextIndex];

  setWindowPinMode(nextMode);
  return nextMode;
}

/**
 * 現在のピンモードに基づいてウィンドウの動作を更新する
 */
function updateWindowBehavior(): void {
  if (!mainWindow) return;

  // alwaysOnTopモードのみ最前面に固定、他は通常表示
  mainWindow.setAlwaysOnTop(windowPinMode === 'alwaysOnTop');
}

/**
 * アプリケーションの編集モードを設定し、それに応じてウィンドウサイズを調整する
 * 編集モード時はウィンドウサイズを拡大し、通常モード時は元のサイズに戻す
 * 編集モード中はフォーカス喪失時に自動非表示されないように制御される
 */
export async function setEditMode(editMode: boolean): Promise<void> {
  isEditMode = editMode;
  if (!mainWindow) return;

  const settingsService = await SettingsService.getInstance();

  if (editMode) {
    const currentBounds = mainWindow.getBounds();
    normalWindowBounds = { width: currentBounds.width, height: currentBounds.height };
    const editWidth = await settingsService.get('editModeWidth');
    const editHeight = await settingsService.get('editModeHeight');
    mainWindow.setSize(editWidth, editHeight);
  } else if (normalWindowBounds) {
    mainWindow.setSize(normalWindowBounds.width, normalWindowBounds.height);
  } else {
    const normalWidth = await settingsService.get('windowWidth');
    const normalHeight = await settingsService.get('windowHeight');
    mainWindow.setSize(normalWidth, normalHeight);
  }

  mainWindow.center();
}

export function getEditMode(): boolean {
  return isEditMode;
}

/**
 * モーダルモードの切り替え
 * モーダル表示時は必要に応じてウィンドウサイズを拡大し、閉じる時は元のサイズに戻す
 * モーダル表示中はフォーカス喪失時に自動非表示されないように制御される
 */
export async function setModalMode(
  isModal: boolean,
  requiredSize?: { width: number; height: number }
): Promise<void> {
  isModalMode = isModal;
  if (!mainWindow) return;

  if (isModal && requiredSize) {
    if (!normalWindowBounds) {
      const { width, height } = mainWindow.getBounds();
      normalWindowBounds = { width, height };
    }
    const { needsResize, newSize } = calculateModalSize(mainWindow.getBounds(), requiredSize);
    if (needsResize) {
      mainWindow.setSize(newSize.width, newSize.height);
      mainWindow.center();
    }
  } else if (normalWindowBounds) {
    mainWindow.setSize(normalWindowBounds.width, normalWindowBounds.height);
    mainWindow.center();
    normalWindowBounds = null;
  }
}

export function getTray(): Tray | null {
  return tray;
}

/**
 * 初回起動モードを設定する
 * 初回起動モードではフォーカスが外れても、Escapeキーを押してもウィンドウが閉じない
 * @param isFirstLaunch 初回起動モードかどうか
 */
export function setFirstLaunchMode(isFirstLaunch: boolean): void {
  isFirstLaunchMode = isFirstLaunch;
  windowLogger.info(`初回起動モード: ${isFirstLaunch ? '有効' : '無効'}`);
}

/**
 * ウィンドウ位置を画面内に収まるよう調整する
 * @param x 目標X座標
 * @param y 目標Y座標
 * @param windowWidth ウィンドウ幅
 * @param windowHeight ウィンドウ高さ
 * @param displayBounds ディスプレイの作業領域
 * @returns 調整後の座標
 */
function adjustPositionToDisplay(
  x: number,
  y: number,
  windowWidth: number,
  windowHeight: number,
  displayBounds: Rectangle
): { x: number; y: number } {
  const adjustedX = Math.max(
    displayBounds.x,
    Math.min(x, displayBounds.x + displayBounds.width - windowWidth)
  );
  const adjustedY = Math.max(
    displayBounds.y,
    Math.min(y, displayBounds.y + displayBounds.height - windowHeight)
  );
  return { x: adjustedX, y: adjustedY };
}

/**
 * ウィンドウを指定されたモードに応じた位置に配置する
 * @param mode ウィンドウ表示位置モード ('center' | 'cursor' | 'fixed')
 */
export async function setWindowPosition(mode?: WindowPositionMode): Promise<void> {
  if (!mainWindow) return;

  const settingsService = await SettingsService.getInstance();
  const positionMode = mode || (await settingsService.get('windowPositionMode'));

  switch (positionMode) {
    case 'center':
      mainWindow.center();
      windowLogger.info('ウィンドウを画面中央に配置しました');
      break;

    case 'cursor': {
      const cursorPoint = screen.getCursorScreenPoint();
      const bounds = mainWindow.getBounds();
      const display = screen.getDisplayNearestPoint(cursorPoint);

      // カーソル位置がテキストボックス付近に来るようにウィンドウを配置
      const targetX = cursorPoint.x - 100; // 左端からテキストボックスまでの距離
      const targetY = cursorPoint.y - 40; // 上端からテキストボックスまでの距離

      const { x, y } = adjustPositionToDisplay(
        targetX,
        targetY,
        bounds.width,
        bounds.height,
        display.workArea
      );
      mainWindow.setPosition(x, y);
      windowLogger.info(`ウィンドウをカーソル位置に配置しました: (${x}, ${y})`);
      break;
    }

    case 'cursorMonitorCenter': {
      const cursorPoint = screen.getCursorScreenPoint();
      const bounds = mainWindow.getBounds();
      const display = screen.getDisplayNearestPoint(cursorPoint);
      const displayBounds = display.workArea;

      // モニターの中央座標を計算
      const targetX = displayBounds.x + Math.floor((displayBounds.width - bounds.width) / 2);
      const targetY = displayBounds.y + Math.floor((displayBounds.height - bounds.height) / 2);

      const { x, y } = adjustPositionToDisplay(
        targetX,
        targetY,
        bounds.width,
        bounds.height,
        displayBounds
      );
      mainWindow.setPosition(x, y);
      windowLogger.info(`ウィンドウをカーソルのモニター中央に配置しました: (${x}, ${y})`);
      break;
    }

    case 'fixed': {
      const savedX = await settingsService.get('windowPositionX');
      const savedY = await settingsService.get('windowPositionY');

      // 保存された位置が有効かチェック（初回は0,0なので中央に配置）
      if (savedX === 0 && savedY === 0) {
        mainWindow.center();
        // 中央配置後の位置を保存
        const bounds = mainWindow.getBounds();
        await settingsService.set('windowPositionX', bounds.x);
        await settingsService.set('windowPositionY', bounds.y);
        windowLogger.info('初回起動: ウィンドウを画面中央に配置し、位置を保存しました');
      } else {
        mainWindow.setPosition(savedX, savedY);
        windowLogger.info(`ウィンドウを固定位置に配置しました: (${savedX}, ${savedY})`);
      }
      break;
    }
  }
}

/**
 * ウィンドウを画面中央に表示する（タスクトレイメニュー用）
 * 設定に関係なく強制的に画面中央に表示する
 */
export function showWindowAtCenter(): void {
  if (!mainWindow) return;

  setShowingWindowFlag();

  mainWindow.center();
  mainWindow.show();
  mainWindow.focus();
  windowLogger.info('ウィンドウを画面中央に表示しました（タスクトレイメニュー）');
}

/**
 * 現在のウィンドウ位置を保存する（fixedモード時のみ）
 */
export async function saveWindowPosition(): Promise<void> {
  if (!mainWindow) return;

  const settingsService = await SettingsService.getInstance();
  const positionMode = await settingsService.get('windowPositionMode');

  // fixedモードの場合のみ位置を保存
  if (positionMode === 'fixed') {
    const bounds = mainWindow.getBounds();
    await settingsService.set('windowPositionX', bounds.x);
    await settingsService.set('windowPositionY', bounds.y);
    windowLogger.info(`ウィンドウ位置を保存しました: (${bounds.x}, ${bounds.y})`);
  }
}

/**
 * ワークスペース自動表示処理（共通ヘルパー関数）
 * autoShowWorkspace設定が有効な場合、ワークスペースを表示する
 * メインウィンドウのフォーカスを維持するため、skipFocus: trueで表示
 */
async function autoShowWorkspaceIfEnabled(): Promise<void> {
  const settingsService = await SettingsService.getInstance();
  const autoShowWorkspace = await settingsService.get('autoShowWorkspace');

  if (autoShowWorkspace) {
    const { showWorkspaceWindow } = await import('./workspaceWindowManager.js');
    // メイン画面のフォーカスを維持するため、skipFocus: trueで表示
    await showWorkspaceWindow({ skipFocus: true });
    windowLogger.info('ワークスペースを自動表示しました');
  }
}

/**
 * メインウィンドウをアクティブ化して検索欄にフォーカス（共通ヘルパー関数）
 * ワークスペース自動表示処理を含む
 */
async function activateMainWindowWithFocus(): Promise<void> {
  if (!mainWindow) return;

  // ワークスペース自動表示（メインウィンドウのフォーカス前に実行）
  await autoShowWorkspaceIfEnabled();

  // メインウィンドウに確実にフォーカスを戻す
  mainWindow.focus();

  // 検索欄にフォーカスを当てるため、window-shownイベントを送信
  mainWindow.webContents.send('window-shown');
  windowLogger.info('メインウィンドウをアクティブにしました');
}

/**
 * メインウィンドウを表示する共通処理
 * @param eventName 送信するイベント名
 * @param startTime パフォーマンス計測用の開始時刻
 * @param enableTimer パフォーマンスタイマーを有効にするか
 */
async function showMainWindowInternal(
  eventName: string,
  startTime?: number,
  enableTimer: boolean = false
): Promise<void> {
  if (!mainWindow) return;

  const timer = enableTimer
    ? new PerformanceTimer(startTime, (msg) => windowLogger.info(msg))
    : null;
  timer?.log(`hotkey-pressed: 0.00ms (start: ${startTime})`);

  setShowingWindowFlag();

  await setWindowPosition();
  timer?.log('position-set');

  await autoShowWorkspaceIfEnabled();
  timer?.log('workspace-auto-shown');

  mainWindow.show();
  timer?.log('window-shown');

  mainWindow.focus();
  timer?.log('window-focused');

  mainWindow.webContents.send(eventName, startTime);
}

/**
 * メインウィンドウを表示する（ホットキー用）
 * 設定されたモードに応じてウィンドウ位置を設定してから表示する
 */
export async function showMainWindow(startTime?: number): Promise<void> {
  await showMainWindowInternal('window-shown', startTime, true);
  windowLogger.info('メインウィンドウを表示しました');
}

/**
 * メインウィンドウを表示し、アイテム検索モードに切り替える（アイテム検索ホットキー用）
 * 設定されたモードに応じてウィンドウ位置を設定してから表示する
 */
export async function showMainWindowWithItemSearch(startTime?: number): Promise<void> {
  await showMainWindowInternal('window-shown-item-search', startTime);
  windowLogger.info('メインウィンドウをアイテム検索モードで表示しました');
}

/**
 * メインウィンドウを非表示にする（ホットキー用）
 * ピン留めモード、編集モード、モーダルモード、初回起動モード時は非表示にしない
 */
export async function hideMainWindow(): Promise<void> {
  if (!mainWindow) return;

  if (windowPinMode === 'alwaysOnTop' || windowPinMode === 'stayVisible') {
    await activateMainWindowWithFocus();
    return;
  }

  if (isFirstLaunchMode || isEditMode || isModalMode) {
    windowLogger.info('現在のモードではホットキーで非表示にできません');
    return;
  }

  hideMainWindowInternal();
  windowLogger.info('メインウィンドウを非表示にしました');
}
