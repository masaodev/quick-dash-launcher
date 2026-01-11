import * as path from 'path';

import { BrowserWindow, Tray, Menu, nativeImage, app, shell, screen, dialog } from 'electron';
import { windowLogger } from '@common/logger';
import type { WindowPinMode, WindowPositionMode } from '@common/types';
import { PerformanceTimer } from '@common/utils/performanceTimer';

import { HotkeyService } from './services/hotkeyService.js';
import { SettingsService } from './services/settingsService.js';
import { showAdminWindowWithTab } from './adminWindowManager.js';
import PathManager from './config/pathManager.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// 環境変数WINDOW_PIN_MODEから初期ピンモードを取得（デフォルト: 'normal'）
function getInitialWindowPinMode(): WindowPinMode {
  const envMode = process.env.WINDOW_PIN_MODE;
  const validModes: WindowPinMode[] = ['normal', 'alwaysOnTop', 'stayVisible'];

  if (envMode && validModes.includes(envMode as WindowPinMode)) {
    return envMode as WindowPinMode;
  }

  if (envMode) {
    windowLogger.warn(`無効なWINDOW_PIN_MODE: ${envMode}, デフォルト'normal'を使用`);
  }

  return 'normal';
}

let windowPinMode: WindowPinMode = getInitialWindowPinMode();
let isEditMode: boolean = false;
let isFirstLaunchMode: boolean = false;
let isModalMode: boolean = false;
let normalWindowBounds: { width: number; height: number } | null = null;

/**
 * メインウィンドウを非表示にし、レンダラープロセスに通知を送る
 * window-hiddenイベントを送信してから、実際にウィンドウを非表示にする
 */
function hideMainWindowInternal(): void {
  if (!mainWindow) return;

  // レンダラープロセスに非表示通知を送る
  mainWindow.webContents.send('window-hidden');

  // ウィンドウを非表示にする
  mainWindow.hide();
}

/**
 * アプリケーションのメインウィンドウを作成し、初期設定を行う
 * 初期状態では通常モード（非最前面）で、フレームレスで中央に配置される
 * フォーカス喪失時の自動非表示やESCキーでの終了など、ランチャーアプリとしての動作を設定
 *
 * @returns 作成されたBrowserWindowインスタンス
 * @throws Error ウィンドウの作成やコンテンツの読み込みに失敗した場合
 *
 * @example
 * ```typescript
 * const window = createWindow();
 * window.show();
 * ```
 */
export async function createWindow(): Promise<BrowserWindow> {
  const settingsService = await SettingsService.getInstance();
  // 初回起動時は大きめのウィンドウサイズを使用
  const windowWidth = isFirstLaunchMode ? 700 : await settingsService.get('windowWidth');
  const windowHeight = isFirstLaunchMode ? 600 : await settingsService.get('windowHeight');

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    center: true,
    alwaysOnTop: false,
    frame: false,
    show: false,
    icon: path.join(__dirname, '../../assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    const port = process.env.VITE_PORT || '9000';
    mainWindow.loadURL(`http://localhost:${port}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }

  mainWindow.on('blur', () => {
    if (
      mainWindow &&
      !mainWindow.webContents.isDevToolsOpened() &&
      shouldHideOnBlur() &&
      !isEditMode &&
      !isFirstLaunchMode &&
      !isModalMode
    ) {
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
  if (process.env.WINDOW_PIN_MODE) {
    updateWindowBehavior();
    windowLogger.info(`初期ピンモードを設定しました: ${windowPinMode}`);
  }

  return mainWindow;
}

export async function createTray(): Promise<void> {
  const iconPath = path.join(__dirname, '../../assets/icon.ico');
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
        // 開発モードかどうかを判定
        const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === '1';

        if (isDev) {
          // 開発モードでは警告ダイアログを表示
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
          // 本番モードでは通常の再起動を実行
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
    const hotkeyService = HotkeyService.getInstance(() => mainWindow);
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

  switch (windowPinMode) {
    case 'normal':
      mainWindow.setAlwaysOnTop(false);
      break;
    case 'alwaysOnTop':
      mainWindow.setAlwaysOnTop(true);
      break;
    case 'stayVisible':
      mainWindow.setAlwaysOnTop(false);
      break;
  }
}

/**
 * フォーカス喪失時にウィンドウを非表示にするかどうかを判定する
 * @returns true: 非表示にする, false: 非表示にしない
 */
function shouldHideOnBlur(): boolean {
  return windowPinMode === 'normal';
}

/**
 * アプリケーションの編集モードを設定し、それに応じてウィンドウサイズを調整する
 * 編集モード時はウィンドウサイズを拡大し、通常モード時は元のサイズに戻す
 * 編集モード中はフォーカス喪失時に自動非表示されないように制御される
 *
 * @param editMode - 編集モードのON/OFF（true: 編集モード、false: 通常モード）
 *
 * @example
 * ```typescript
 * // 編集モードを有効にする
 * setEditMode(true);
 *
 * // 編集モードを無効にする
 * setEditMode(false);
 * ```
 */
export async function setEditMode(editMode: boolean): Promise<void> {
  isEditMode = editMode;

  if (mainWindow) {
    const settingsService = await SettingsService.getInstance();

    if (editMode) {
      // 編集モードに入る時：現在のサイズを保存してから大きくする
      const currentBounds = mainWindow.getBounds();
      normalWindowBounds = { width: currentBounds.width, height: currentBounds.height };
      const editWidth = await settingsService.get('editModeWidth');
      const editHeight = await settingsService.get('editModeHeight');
      mainWindow.setSize(editWidth, editHeight);
      mainWindow.center();
    } else {
      // 通常モードに戻る時：元のサイズに戻す
      if (normalWindowBounds) {
        mainWindow.setSize(normalWindowBounds.width, normalWindowBounds.height);
        mainWindow.center();
      } else {
        // normalWindowBoundsが無い場合は設定値を使用
        const normalWidth = await settingsService.get('windowWidth');
        const normalHeight = await settingsService.get('windowHeight');
        mainWindow.setSize(normalWidth, normalHeight);
        mainWindow.center();
      }
    }
  }
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

  if (mainWindow) {
    if (isModal && requiredSize) {
      // モーダル表示時：現在のサイズを保存し、必要な場合のみ拡大
      const currentBounds = mainWindow.getBounds();
      normalWindowBounds = { width: currentBounds.width, height: currentBounds.height };

      // 必要サイズと現在サイズを比較し、必要な場合のみ拡大
      if (currentBounds.width < requiredSize.width || currentBounds.height < requiredSize.height) {
        mainWindow.setSize(
          Math.max(currentBounds.width, requiredSize.width),
          Math.max(currentBounds.height, requiredSize.height)
        );
        mainWindow.center();
      }
    } else {
      // モーダルを閉じる時：元のサイズに復元
      if (normalWindowBounds) {
        mainWindow.setSize(normalWindowBounds.width, normalWindowBounds.height);
        mainWindow.center();
      }
    }
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

      // カーソル位置がテキストボックス付近に来るようにウィンドウを配置
      const offsetX = 100; // 左端からテキストボックスまでの距離
      const offsetY = 40; // 上端からテキストボックスまでの距離
      const x = cursorPoint.x - offsetX;
      const y = cursorPoint.y - offsetY;

      // 画面外に出ないように調整
      const display = screen.getDisplayNearestPoint(cursorPoint);
      const displayBounds = display.workArea;

      const adjustedX = Math.max(
        displayBounds.x,
        Math.min(x, displayBounds.x + displayBounds.width - bounds.width)
      );
      const adjustedY = Math.max(
        displayBounds.y,
        Math.min(y, displayBounds.y + displayBounds.height - bounds.height)
      );

      mainWindow.setPosition(adjustedX, adjustedY);
      windowLogger.info(`ウィンドウをカーソル位置に配置しました: (${adjustedX}, ${adjustedY})`);
      break;
    }

    case 'cursorMonitorCenter': {
      const cursorPoint = screen.getCursorScreenPoint();
      const bounds = mainWindow.getBounds();

      // カーソルがあるモニターを特定
      const display = screen.getDisplayNearestPoint(cursorPoint);
      const displayBounds = display.workArea;

      // モニターの中央座標を計算
      const x = displayBounds.x + Math.floor((displayBounds.width - bounds.width) / 2);
      const y = displayBounds.y + Math.floor((displayBounds.height - bounds.height) / 2);

      // 画面外に出ないように調整（安全性チェック）
      const adjustedX = Math.max(
        displayBounds.x,
        Math.min(x, displayBounds.x + displayBounds.width - bounds.width)
      );
      const adjustedY = Math.max(
        displayBounds.y,
        Math.min(y, displayBounds.y + displayBounds.height - bounds.height)
      );

      mainWindow.setPosition(adjustedX, adjustedY);
      windowLogger.info(
        `ウィンドウをカーソルのモニター中央に配置しました: (${adjustedX}, ${adjustedY})`
      );
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
 * このメソッドは設定に関係なく強制的に画面中央に表示します
 */
export function showWindowAtCenter(): void {
  if (!mainWindow) return;

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
 * メインウィンドウを表示する（ホットキー用）
 * 設定されたモードに応じてウィンドウ位置を設定してから表示します
 * @param startTime パフォーマンス計測用の開始時刻（Date.now()の値）
 */
export async function showMainWindow(startTime?: number): Promise<void> {
  if (!mainWindow) return;

  const timer = new PerformanceTimer(startTime, (msg) => windowLogger.info(msg));
  timer.log(`hotkey-pressed: 0.00ms (start: ${startTime})`);

  await setWindowPosition();
  timer.log('position-set');

  // ワークスペース自動表示の処理
  const settingsService = await SettingsService.getInstance();
  const autoShowWorkspace = await settingsService.get('autoShowWorkspace');

  if (autoShowWorkspace) {
    const { isWorkspaceWindowShown, showWorkspaceWindow } = await import(
      './workspaceWindowManager.js'
    );
    if (!isWorkspaceWindowShown()) {
      await showWorkspaceWindow();
      timer.log('workspace-auto-shown');
    }
  }

  mainWindow.show();
  timer.log('window-shown');

  mainWindow.focus();
  timer.log('window-focused');

  mainWindow.webContents.send('window-shown', startTime);
  windowLogger.info('メインウィンドウを表示しました');
}

/**
 * メインウィンドウを非表示にする（ホットキー用）
 * ピン留めモード、編集モード、モーダルモード、初回起動モード時は非表示にしない
 */
export function hideMainWindow(): void {
  if (!mainWindow) return;

  // 以下の場合はホットキーでも閉じない
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

  if (shouldNotHide) {
    windowLogger.info('現在のモードではホットキーで非表示にできません');
    return;
  }

  hideMainWindowInternal();
  windowLogger.info('メインウィンドウを非表示にしました');
}
