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
import { IPC_CHANNELS, type IpcChannelName } from '@common/ipcChannels';
import { windowLogger } from '@common/logger';
import type { WindowPinMode, WindowPositionMode } from '@common/types';
import { PerformanceTimer } from '@common/utils/performanceTimer';

import { HotkeyService } from './services/hotkeyService.js';
import { SettingsService } from './services/settingsService.js';
import { mainI18n } from './services/mainI18n.js';
import { showAdminWindowWithTab } from './adminWindowManager.js';
import PathManager from './config/pathManager.js';
import { EnvConfig } from './config/envConfig.js';
import { DEFAULT_WEB_PREFERENCES } from './utils/managedWindow.js';
import {
  bringDetachedToFront,
  hideAllDetachedGroupWindows,
  isDetachedGroupWindow,
  showAllDetachedGroupWindows,
} from './detachedGroupWindowManager.js';
import {
  bringWorkspaceToFront,
  getWorkspaceWindow,
  hideWorkspaceWithMain,
  showWorkspaceWithMain,
} from './workspaceWindowManager.js';
import { moveWindowToCurrentDesktop } from './utils/virtualDesktop/index.js';
import { registerChildWindowOpener } from './services/childWindowService.js';
import { isPositionOnScreen } from './utils/screenPosition.js';
import { registerMainWindowBoundsProvider } from './utils/referenceDisplay.js';
import { notifyPinLevel, pinModeToLevel } from './utils/pinMenu.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let trayLanguageListenerAdded = false;

let windowPinMode: WindowPinMode = EnvConfig.windowPinMode ?? 'normal';
let isFirstLaunchMode: boolean = false;
let isModalMode: boolean = false;
// メインウィンドウのページで Esc を受けるか（複数選択・確認の帯があるあいだ。レンダラーが知らせる）
let escapeHandledByPage = false;
let windowShownAt = 0; // メインウィンドウを最後に表示した時刻（表示直後のフォーカスの揺れ対策）

/** 表示直後のフォーカスの揺れが収まるまでの時間（ms）。この間のblurは収まってから移動先を確認する */
const BLUR_SETTLE_AFTER_SHOW_MS = 200;

/** blur後にフォーカスの移動先を確認するまでの待ち時間（ms） */
const BLUR_FOCUS_CHECK_DELAY_MS = 50;

/**
 * メインウィンドウと一緒に、ワークスペース（開いているもの）と切り離しウィンドウを出し入れする（即座）
 * 隠すのは 📌 なしのものだけ。出すときは、📌 ありのものを手前に出す
 */
async function toggleCompanionWindows(show: boolean): Promise<void> {
  if (show) {
    await showWorkspaceWithMain();
    const settingsService = await SettingsService.getInstance();
    const positionMode = await settingsService.get('detachedPositionMode');
    showAllDetachedGroupWindows({ placeOnMainWindowDisplay: positionMode === 'mainDisplay' });
  } else {
    hideWorkspaceWithMain();
    hideAllDetachedGroupWindows();
  }
}

/**
 * 起動時の復元が終わったときに呼ぶ。復元より先にホットキーでメインウィンドウを出していたら、
 * 後から隠したまま作った 📌 なしのウィンドウもメインと一緒に出す（次のホットキーまで隠れたままにしない）
 */
export async function syncCompanionWindowsWithMain(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;
  await toggleCompanionWindows(true);
}

/**
 * QDLのウィンドウ群（メイン・ワークスペース・切り離しウィンドウと、それらの子ウィンドウ）に
 * フォーカスがあるかどうかを返す。管理ウィンドウ（設定画面）は含めない
 */
function isQdlWindowFocused(): boolean {
  let win = BrowserWindow.getFocusedWindow();
  while (win) {
    if (win === mainWindow || win === getWorkspaceWindow() || isDetachedGroupWindow(win)) {
      return true;
    }
    win = win.getParentWindow();
  }
  return false;
}

/**
 * メインウィンドウを隠した後の連動非表示（50ms遅延 + フォーカスチェック付き）
 * QDLのウィンドウ群にフォーカスがある場合は切り離しウィンドウを非表示にしない
 */
function hideDetachedWindowsAfterBlur(): void {
  setTimeout(async () => {
    try {
      if (isQdlWindowFocused()) return;
      await toggleCompanionWindows(false);
    } catch (error) {
      windowLogger.warn({ error }, 'blur時の切り離しウィンドウ連動非表示チェックに失敗');
    }
  }, BLUR_FOCUS_CHECK_DELAY_MS);
}

/**
 * メインウィンドウを非表示にし、レンダラープロセスに通知を送る
 * window-hiddenイベントを送信してから、実際にウィンドウを非表示にする
 */
function hideMainWindowInternal(): void {
  if (!mainWindow) return;

  // レンダラープロセスに非表示通知を送る
  mainWindow.webContents.send(IPC_CHANNELS.EVENT_WINDOW_HIDDEN);

  // ウィンドウを非表示にする
  mainWindow.hide();
}

/**
 * フォーカス喪失時にメインウィンドウを非表示にしてよい状態か
 */
function shouldHideOnBlur(): boolean {
  return (
    !!mainWindow &&
    !mainWindow.webContents.isDevToolsOpened() &&
    windowPinMode === 'normal' &&
    !isFirstLaunchMode &&
    !isModalMode
  );
}

/**
 * フォーカスがQDLのウィンドウ群の外へ出ていれば、メインウィンドウと、ピン留めしていないワークスペース・切り離しウィンドウを隠す
 * ウィンドウ群の中でフォーカスが移っただけなら何もしない
 */
async function hideWindowsIfFocusLeftQdl(): Promise<void> {
  if (isQdlWindowFocused()) return;

  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    // メインウィンドウを表示し続けるモード（ピン留め等）では切り離しウィンドウも残す
    if (!shouldHideOnBlur()) return;
    hideMainWindowInternal();
  }
  await toggleCompanionWindows(false);
}

/**
 * QDLのいずれかのウィンドウのblur後に、フォーカスの移動先を確認して連動非表示する
 * 表示直後のblurは、フォーカスの揺れが収まってから確認する
 */
function scheduleHideIfFocusLeftQdl(): void {
  const untilSettled = BLUR_SETTLE_AFTER_SHOW_MS - (Date.now() - windowShownAt);
  setTimeout(
    () => {
      hideWindowsIfFocusLeftQdl().catch((error) => {
        windowLogger.warn({ error }, 'blur時の連動非表示チェックに失敗');
      });
    },
    Math.max(BLUR_FOCUS_CHECK_DELAY_MS, untilSettled)
  );
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

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    center: true,
    alwaysOnTop: false,
    frame: false,
    show: false,
    icon: iconPath,
    webPreferences: DEFAULT_WEB_PREFERENCES,
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

  // ワークスペース・オーバーレイはこのレンダラーから window.open で開き、プロセスを共有する
  registerChildWindowOpener('main', mainWindow.webContents);

  // ワークスペース・切り離しウィンドウを「メインウィンドウと同じディスプレイ」に出すための基準
  registerMainWindowBoundsProvider(() =>
    mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : null
  );

  mainWindow.on('show', () => {
    windowShownAt = Date.now();
  });

  // メイン・ワークスペース・切り離しウィンドウのどれのblurでも、フォーカスがQDLの外へ出たかを確認する
  // （ウィンドウ群の中での移動では隠さない）
  app.removeListener('browser-window-blur', scheduleHideIfFocusLeftQdl);
  app.on('browser-window-blur', scheduleHideIfFocusLeftQdl);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // ウィンドウ移動時に位置を保存（fixedモードの場合のみ）
  mainWindow.on('moved', () => {
    void saveWindowPosition();
  });

  // ページを読み直すとき・ページが落ちたときは、ページで受ける印を戻す
  //（ページ側の後始末が走らなくても Esc で隠れるように）
  mainWindow.webContents.on('did-start-loading', () => {
    escapeHandledByPage = false;
  });
  mainWindow.webContents.on('render-process-gone', () => {
    escapeHandledByPage = false;
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      // ページで取り消すものがある（複数選択・確認の帯）あいだは、ページに渡して隠さない
      if (escapeHandledByPage) return;
      event.preventDefault();
      // 以下の場合はEscapeキーで閉じない
      // - 初回起動モード
      // - モーダルモード
      // - ピン留めモードがalwaysOnTopまたはstayVisible
      const shouldNotHide =
        isFirstLaunchMode ||
        isModalMode ||
        windowPinMode === 'alwaysOnTop' ||
        windowPinMode === 'stayVisible';

      if (mainWindow && !shouldNotHide) {
        hideMainWindowInternal();
        void toggleCompanionWindows(false);
      }
    }
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
  tray.setToolTip('QuickDashLauncher');
  await updateTrayMenu();

  // 表示言語が変わったらメニューを作り直す（トレイを作り直しても登録は 1 回だけ）
  if (!trayLanguageListenerAdded) {
    trayLanguageListenerAdded = true;
    mainI18n.on('languageChanged', () => {
      updateTrayMenu().catch((error) =>
        windowLogger.error({ error }, 'トレイのメニューの更新に失敗')
      );
    });
  }

  // ホットキーと同じ表示処理を通す（ワークスペース・切り離しウィンドウも一緒に出す）
  tray.on('double-click', () => {
    void showMainWindow();
  });
}

/** トレイの右クリックメニューを今の表示言語・ホットキーで作り直す */
async function updateTrayMenu(): Promise<void> {
  if (!tray || tray.isDestroyed()) return;
  const t = mainI18n.t.bind(mainI18n);

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
      label: `${t('tray.show')}${hotkeyLabel}`,
      click: () => {
        if (mainWindow) {
          void showMainWindow();
        }
      },
    },
    {
      label: t('tray.showAtCenter'),
      click: () => {
        void showWindowAtCenter();
      },
    },
    {
      label: t('tray.settings'),
      click: async () => {
        await showAdminWindowWithTab('settings');
      },
    },
    { type: 'separator' },
    {
      label: t('tray.openSettingsFolder'),
      click: async () => {
        const configFolder = PathManager.getConfigFolder();
        await shell.openPath(configFolder);
      },
    },
    { type: 'separator' },
    {
      label: t('tray.help'),
      click: async () => {
        await shell.openExternal('https://github.com/masaodev/quick-dash-launcher');
      },
    },
    { type: 'separator' },
    {
      label: t('tray.restart'),
      click: async () => {
        if (EnvConfig.isDevelopment) {
          const result = await dialog.showMessageBox({
            type: 'warning',
            title: t('tray.devRestart.title'),
            message: t('tray.devRestart.message'),
            detail: t('tray.devRestart.detail'),
            buttons: [t('common.cancel'), t('tray.devRestart.quit')],
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
      label: t('tray.quit'),
      click: () => {
        app.quit();
      },
    },
  ]);

  // await の間に終了処理でトレイが破棄されていることがある
  if (!tray || tray.isDestroyed()) return;
  tray.setContextMenu(contextMenu);
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

/**
 * メインウィンドウの Esc をページで受けるかを設定する（true のあいだは Esc で隠さない）
 */
export function setEscapeHandledByPage(handled: boolean): void {
  escapeHandledByPage = handled;
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
  notifyPinLevel(mainWindow, pinModeToLevel(mode));
}

/**
 * 現在のピンモードに基づいてウィンドウの動作を更新する
 */
function updateWindowBehavior(): void {
  if (!mainWindow) return;

  // alwaysOnTopモードのみ最前面に固定、他は通常表示。モーダルモード中は子ウィンドウを閉じるまで最前面のまま
  mainWindow.setAlwaysOnTop(isModalMode || windowPinMode === 'alwaysOnTop');
}

/**
 * モーダルモードの切り替え
 *
 * メイン画面の子ウィンドウ（アイテムの登録・編集、アイコン取得結果）が開いている間に
 * メインプロセスが ON にする（`mainChildWindowManager.ts`）。モーダルモード中は
 * フォーカス喪失・Escape・ホットキー・アイテム実行でウィンドウが隠れず、最前面に固定される。
 * ウィンドウのサイズ・位置は変えない（以前はモーダルの要求サイズに広げて中央へ動かしていた）。
 */
export async function setModalMode(isModal: boolean): Promise<void> {
  isModalMode = isModal;
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (isModal) {
    // モーダル表示中は最前面に固定
    mainWindow.setAlwaysOnTop(true);
  } else {
    // 元のピンモードに応じて最前面設定を復元
    mainWindow.setAlwaysOnTop(windowPinMode === 'alwaysOnTop');
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
  const wasFirstLaunch = isFirstLaunchMode;
  isFirstLaunchMode = isFirstLaunch;
  windowLogger.info({ isFirstLaunch }, '初回起動モードを切り替えました');
  if (wasFirstLaunch && !isFirstLaunch) void restoreWindowSizeAfterFirstLaunch();
}

/**
 * 初回設定を終えたら、初回設定用の大きさ（700x600）から設定の大きさに戻す（中心は保つ）
 * 戻さないと、次に起動し直すまで初回設定の大きさのままになる
 */
async function restoreWindowSizeAfterFirstLaunch(): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const settingsService = await SettingsService.getInstance();
  const width = await settingsService.get('windowWidth');
  const height = await settingsService.get('windowHeight');
  const bounds = mainWindow.getBounds();
  mainWindow.setBounds({
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: Math.round(bounds.y + (bounds.height - height) / 2),
    width,
    height,
  });
  windowLogger.info(
    { width, height },
    '初回設定を終えたので、ウィンドウを設定の大きさに戻しました'
  );
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

      // 初回（0,0）と、保存位置が画面外（モニターを外した後など）のときは中央に置き直す
      const isFirstLaunch = savedX === 0 && savedY === 0;
      if (isFirstLaunch || !isPositionOnScreen(savedX, savedY)) {
        mainWindow.center();
        // 中央配置後の位置を保存
        const bounds = mainWindow.getBounds();
        await settingsService.set('windowPositionX', bounds.x);
        await settingsService.set('windowPositionY', bounds.y);
        if (isFirstLaunch) {
          windowLogger.info('初回起動: ウィンドウを画面中央に配置し、位置を保存しました');
        } else {
          windowLogger.warn(
            `保存位置 (${savedX}, ${savedY}) が画面外のため、画面中央に配置し直しました`
          );
        }
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
 * 設定に関係なく強制的に画面中央に表示する。ほかはホットキーと同じ（ワークスペース・切り離しウィンドウも一緒に出す）
 */
export async function showWindowAtCenter(): Promise<void> {
  await showMainWindowInternal(IPC_CHANNELS.EVENT_WINDOW_SHOWN, { placeAtCenter: true });
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
 * 表示中のワークスペース・切り離しウィンドウ（📌 の有無を問わない）を、ほかのウィンドウの下にあっても手前に出す
 * メインウィンドウにフォーカスを移した後に呼ぶ（その前だとほかのアプリが前面で、Windows が並べ替えを無視することがある）。
 * 最後にメインウィンドウを一番手前に戻す
 */
function bringCompanionsToFront(): void {
  if (!mainWindow) return;
  bringWorkspaceToFront();
  bringDetachedToFront();
  mainWindow.moveTop();
}

/**
 * メインウィンドウをアクティブ化して検索欄にフォーカス（共通ヘルパー関数）
 * 開いているワークスペース・切り離しウィンドウも一緒に出す
 */
async function activateMainWindowWithFocus(): Promise<void> {
  if (!mainWindow) return;

  // ワークスペース・切り離しウィンドウも一緒に出す（メインウィンドウのフォーカス前に実行）
  await toggleCompanionWindows(true);

  // メインウィンドウに確実にフォーカスを戻す
  mainWindow.focus();
  bringCompanionsToFront();

  // 検索欄にフォーカスを当てるため、window-shownイベントを送信
  // （時刻も渡し、表示したときと同じく描画が止まっていないかをレンダラーに記録させる。A3-130）
  windowLogger.info('メインウィンドウをアクティブにしました');
  mainWindow.webContents.send(IPC_CHANNELS.EVENT_WINDOW_SHOWN, Date.now());
}

/**
 * メインウィンドウを表示する共通処理
 * @param eventName 送信するイベント名
 * @param options.startTime パフォーマンス計測用の開始時刻
 * @param options.enableTimer パフォーマンスタイマーを有効にするか
 * @param options.placeAtCenter 設定に関係なく画面中央に置くか（タスクトレイの「中央に表示」）
 */
async function showMainWindowInternal(
  eventName: IpcChannelName,
  options: { startTime?: number; enableTimer?: boolean; placeAtCenter?: boolean } = {}
): Promise<void> {
  if (!mainWindow) return;
  const { startTime, enableTimer = false, placeAtCenter = false } = options;

  const timer = enableTimer
    ? new PerformanceTimer(startTime, (msg) => windowLogger.info(msg))
    : null;
  timer?.log(`hotkey-pressed: 0.00ms (start: ${startTime})`);

  if (placeAtCenter) {
    mainWindow.center();
  } else {
    await setWindowPosition();
  }
  timer?.log('position-set');

  await toggleCompanionWindows(true);
  timer?.log('companion-windows-shown');

  // 表示したまま別の仮想デスクトップにある（ピン留め中など）と show() では出てこない
  bringMainWindowToCurrentDesktop();
  mainWindow.show();
  timer?.log('window-shown');

  mainWindow.focus();
  timer?.log('window-focused');

  bringCompanionsToFront();

  mainWindow.webContents.send(eventName, startTime);
}

/**
 * メインウィンドウを表示する（ホットキー用）
 * 設定されたモードに応じてウィンドウ位置を設定してから表示する
 */
export async function showMainWindow(startTime?: number): Promise<void> {
  await showMainWindowInternal(IPC_CHANNELS.EVENT_WINDOW_SHOWN, { startTime, enableTimer: true });
  windowLogger.info('メインウィンドウを表示しました');
}

/**
 * メインウィンドウを表示し、アイテム検索モードに切り替える（アイテム検索ホットキー用）
 * 設定されたモードに応じてウィンドウ位置を設定してから表示する
 */
export async function showMainWindowWithItemSearch(startTime?: number): Promise<void> {
  await showMainWindowInternal(IPC_CHANNELS.EVENT_WINDOW_SHOWN_ITEM_SEARCH, { startTime });
  windowLogger.info('メインウィンドウをアイテム検索モードで表示しました');
}

/**
 * アイテム実行時にメインウィンドウを即座に非表示にする
 * 起動したアプリがフォーカスを奪う（blur）のを待たずに閉じることで、
 * 起動待ちの間にEnterを連打して多重起動してしまうのを防ぐ
 * ピン留めモード、モーダルモード、初回起動モード時は非表示にしない
 */
export function hideMainWindowOnExecute(): void {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;

  if (windowPinMode !== 'normal' || isFirstLaunchMode || isModalMode) {
    return;
  }

  hideMainWindowInternal();
  hideDetachedWindowsAfterBlur();
}

/**
 * メインウィンドウが別の仮想デスクトップにあれば、今のデスクトップへ移す
 * @returns 移したら true（同じデスクトップ・全デスクトップに表示中・番号が取れないときは false）
 */
function bringMainWindowToCurrentDesktop(): boolean {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const moved = moveWindowToCurrentDesktop(mainWindow.getNativeWindowHandle().readBigUInt64LE());
  if (moved) windowLogger.info('メインウィンドウを今の仮想デスクトップへ移しました');
  return moved;
}

/**
 * メインウィンドウを非表示にする（ホットキー用）
 * ピン留めモード、モーダルモード、初回起動モード時は非表示にしない
 */
export async function hideMainWindow(): Promise<void> {
  if (!mainWindow) return;

  if (windowPinMode === 'alwaysOnTop' || windowPinMode === 'stayVisible') {
    await activateMainWindowWithFocus();
    return;
  }

  if (isFirstLaunchMode) {
    // 初回設定の「試してみる」で、押せたことを画面に出す
    mainWindow.webContents.send(IPC_CHANNELS.EVENT_FIRST_LAUNCH_HOTKEY_PRESSED);
    windowLogger.info('初回設定の途中なので、ホットキーで非表示にせず画面に知らせました');
    return;
  }

  if (isModalMode) {
    windowLogger.info('現在のモードではホットキーで非表示にできません');
    return;
  }

  hideMainWindowInternal();
  await toggleCompanionWindows(false);

  windowLogger.info('メインウィンドウを非表示にしました');
}
