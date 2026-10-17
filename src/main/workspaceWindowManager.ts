import { BrowserWindow, Display, screen } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';
import { windowLogger } from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';
import type { PinLevel, WorkspacePositionMode } from '@common/types';
import { MAIN_WINDOW_DISPLAY_INDEX } from '@common/types';

import { SettingsService } from './services/settingsService.js';
import PathManager from './config/pathManager.js';
import {
  moveWindowToCurrentDesktop,
  pinWindow,
  unPinWindow,
} from './utils/virtualDesktop/index.js';
import { attachSnapHandler } from './utils/windowSnap.js';
import { isPositionOnScreen, setBoundsAcrossDisplays } from './utils/screenPosition.js';
import { getMainWindowDisplay } from './utils/referenceDisplay.js';
import {
  DEFAULT_WEB_PREFERENCES,
  attachCommonKeyHandlers,
  hideOnClose,
} from './utils/managedWindow.js';
import { restoreDetachedWindows } from './detachedGroupWindowManager.js';
import { WorkspaceService } from './services/workspace/index.js';
import {
  getRendererHtmlUrl,
  openChildWindow,
  registerChildWindowOpener,
} from './services/childWindowService.js';

/**
 * メインウィンドウのレンダラー経由でワークスペースを生成する際の待機上限（ms）
 * 起動時はメインレンダラーの読み込み完了を待つため長めに取る
 */
const WORKSPACE_OPEN_TIMEOUT_MS = 15000;

let workspaceWindow: BrowserWindow | null = null;
/** 生成中の Promise（同時呼び出し時に再利用し、二重生成を防ぐ） */
let pendingCreate: Promise<BrowserWindow> | null = null;
let isWorkspaceWindowVisible: boolean = false;
let detachedRestored: boolean = false;
/** ピン留めの段階。ワークスペースは最初から表示固定（開きっぱなしで使ってもらうため） */
let workspacePinLevel: PinLevel = 1;
/**
 * 開いているか。⭐・Ctrl+W・× で閉じるまで true（メインウィンドウと一緒に隠れただけなら true のまま）。
 * 開いていて 📌 なしなら、メインウィンドウと一緒に出て一緒に隠れる
 */
let isWorkspaceOpen: boolean = false;
let windowSnapEnabled: boolean = true;

/**
 * ワークスペースウィンドウを作成し、初期設定を行う（既存なら表示してフォーカス）
 */
export async function createWorkspaceWindow(): Promise<BrowserWindow> {
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    workspaceWindow.show();
    workspaceWindow.focus();
    return workspaceWindow;
  }
  // 起動時の生成完了を待つ間にホットキー等から呼ばれても二重生成しない
  if (pendingCreate) {
    return pendingCreate;
  }
  pendingCreate = createWorkspaceWindowInternal().finally(() => {
    pendingCreate = null;
  });
  return pendingCreate;
}

/** 開いているか・ピン留めの段階を workspace-ui-state.json に保存する */
function persistWorkspaceWindowState(): void {
  WorkspaceService.getInstance()
    .then((ws) =>
      ws.saveWorkspaceWindowState({ open: isWorkspaceOpen, pinLevel: workspacePinLevel })
    )
    .catch((error) => {
      windowLogger.warn({ error }, 'ワークスペースウィンドウの状態の保存に失敗');
    });
}

function setWorkspaceOpen(open: boolean): void {
  if (isWorkspaceOpen === open) return;
  isWorkspaceOpen = open;
  persistWorkspaceWindowState();
  // メインウィンドウの ⭐ ボタンの押し込み表示を合わせる
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC_CHANNELS.EVENT_WORKSPACE_OPEN_CHANGED, open);
  }
}

/** ワークスペースが開いているか（閉じていない） */
export function isWorkspaceWindowOpen(): boolean {
  return isWorkspaceOpen;
}

async function createWorkspaceWindowInternal(): Promise<BrowserWindow> {
  try {
    const ws = await WorkspaceService.getInstance();
    const state = await ws.loadWorkspaceWindowState();
    workspacePinLevel = state.pinLevel;
    isWorkspaceOpen = state.open;
  } catch (error) {
    windowLogger.warn({ error }, 'ワークスペースウィンドウの状態の読み込みに失敗');
  }

  const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 380;
  const windowHeight = screenHeight;

  const settingsService = await SettingsService.getInstance();
  const opacity = await settingsService.get('workspaceOpacity');
  const backgroundTransparent = await settingsService.get('workspaceBackgroundTransparent');
  windowSnapEnabled = await settingsService.get('windowSnapEnabled');
  const opacityValue = backgroundTransparent ? 1.0 : Math.max(0, Math.min(100, opacity)) / 100;

  const windowOptions: BrowserWindowConstructorOptions = {
    width: windowWidth,
    height: windowHeight,
    alwaysOnTop: workspacePinLevel === 2,
    frame: false,
    show: false,
    resizable: false,
    icon: PathManager.getAppIconPath(),
    transparent: true,
    opacity: opacityValue,
    webPreferences: DEFAULT_WEB_PREFERENCES,
  };

  // メインウィンドウのレンダラーから window.open で開き、レンダラープロセスを共有する
  // （メインウィンドウは常駐なので、常時1プロセス分のメモリを節約できる）
  const sharedWindow = await openChildWindow('main', {
    name: 'workspace',
    html: 'workspace.html',
    options: windowOptions,
    timeoutMs: WORKSPACE_OPEN_TIMEOUT_MS,
  });
  if (sharedWindow) {
    workspaceWindow = sharedWindow;
    windowLogger.info('ワークスペースウィンドウをレンダラー共有で作成しました');
  } else {
    windowLogger.warn(
      'レンダラー共有での生成に失敗したためワークスペースウィンドウを直接生成します'
    );
    workspaceWindow = new BrowserWindow(windowOptions);
    workspaceWindow.loadURL(getRendererHtmlUrl('workspace.html'));
  }

  workspaceWindow.setMenuBarVisibility(false);
  workspaceWindow.setMenu(null);
  workspaceWindow.setIgnoreMouseEvents(false);

  // 切り離しウィンドウはこのレンダラーから window.open で開く
  registerChildWindowOpener('workspace', workspaceWindow.webContents);

  // × は「閉じる」。メインウィンドウと一緒に出てこなくなる
  hideOnClose(workspaceWindow, () => {
    isWorkspaceWindowVisible = false;
    setWorkspaceOpen(false);
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

  attachCommonKeyHandlers(workspaceWindow);

  workspaceWindow.on('moved', () => {
    void saveWorkspacePosition();
  });

  await setWorkspacePosition();

  attachSnapHandler(workspaceWindow, () => windowSnapEnabled);

  windowLogger.info('ワークスペースウィンドウを作成しました');
  return workspaceWindow;
}

/**
 * ワークスペースウィンドウを開く（存在しない場合は新規作成）。閉じるまで「開いている」として覚える
 * @param options.skipFocus trueの場合、フォーカスを奪わずに表示する
 */
export async function showWorkspaceWindow(options?: { skipFocus?: boolean }): Promise<void> {
  setWorkspaceOpen(true);
  await presentWorkspaceWindow(options);
}

/**
 * 開いているワークスペースを、メインウィンドウと一緒に出す（隠れているときだけ。閉じているものは出さない）
 */
export async function showWorkspaceWithMain(): Promise<void> {
  if (!isWorkspaceOpen || isWorkspaceWindowVisible) return;
  await presentWorkspaceWindow({ skipFocus: true });
}

/**
 * メインウィンドウと一緒に隠す（📌 なしのときだけ。開いている状態は変えない）
 */
export function hideWorkspaceWithMain(): void {
  if (workspacePinLevel !== 0) return;
  if (workspaceWindow && !workspaceWindow.isDestroyed() && workspaceWindow.isVisible()) {
    workspaceWindow.hide();
  }
}

/**
 * 起動したときに、直前の状態へ戻す（再起動しても見え方が変わらないように）
 * - 開いていて 📌 ありのワークスペースは、すぐに出す（📌 なしなら、最初のホットキーでメインと一緒に出る）
 * - × で閉じていない切り離しウィンドウを開き直す。📌 ありのものはすぐに出し、なしのものは隠したまま作る
 */
export async function restoreWindowsOnStartup(): Promise<void> {
  try {
    if (isWorkspaceOpen && workspacePinLevel !== 0) {
      await presentWorkspaceWindow({ skipFocus: true });
    }
    if (!detachedRestored) {
      detachedRestored = true;
      await restoreDetachedWindows({ skipFocus: true, startHiddenUnlessPinned: true });
    }
  } catch (error) {
    windowLogger.error({ error }, '起動時のワークスペース・切り離しウィンドウの復元に失敗しました');
  }
}

/** 位置を決めて表示する（開いているかどうかは変えない） */
async function presentWorkspaceWindow(options?: { skipFocus?: boolean }): Promise<void> {
  try {
    if (!workspaceWindow || workspaceWindow.isDestroyed()) {
      await createWorkspaceWindow();
    }

    if (workspaceWindow) {
      await setWorkspacePosition();
      // 表示中でも別の仮想デスクトップにあると show() では出てこない（自動表示のとき）
      moveWindowToCurrentDesktop(workspaceWindow.getNativeWindowHandle().readBigUInt64LE());
      workspaceWindow.show();
      if (!options?.skipFocus) {
        workspaceWindow.focus();
      }
      await applyVisibilityOnAllDesktops();
      windowLogger.info('ワークスペースウィンドウを表示しました');

      if (!detachedRestored) {
        detachedRestored = true;
        try {
          await restoreDetachedWindows({ skipFocus: options?.skipFocus });
        } catch (error) {
          windowLogger.error({ error }, '切り離しウィンドウの自動復元に失敗しました');
        }
      }
    }
  } catch (error) {
    windowLogger.error({ error }, 'ワークスペースウィンドウの表示に失敗しました');
  }
}

/** ワークスペースウィンドウを閉じる（⭐・Ctrl+W・×）。メインウィンドウと一緒に出てこなくなる */
export function hideWorkspaceWindow(): void {
  setWorkspaceOpen(false);
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    workspaceWindow.hide();
    windowLogger.info('ワークスペースウィンドウを非表示にしました');
  }
}

/** ワークスペースウィンドウを完全に閉じる（アプリケーション終了時に使用） */
export function closeWorkspaceWindow(): void {
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    workspaceWindow.destroy();
    workspaceWindow = null;
    isWorkspaceWindowVisible = false;
    windowLogger.info('ワークスペースウィンドウを閉じました');
  }
}

/** ワークスペースウィンドウの表示状態を切り替える */
export async function toggleWorkspaceWindow(): Promise<void> {
  // 表示したまま別の仮想デスクトップにある（全デスクトップに表示しない設定のとき）なら、隠さずに今のデスクトップへ呼び寄せる。
  // 隠すと、Windows がフォーカスの移り先のデスクトップへ切り替えてしまうことがある
  if (
    isWorkspaceWindowVisible &&
    workspaceWindow &&
    !workspaceWindow.isDestroyed() &&
    moveWindowToCurrentDesktop(workspaceWindow.getNativeWindowHandle().readBigUInt64LE())
  ) {
    workspaceWindow.show();
    workspaceWindow.focus();
    windowLogger.info('ワークスペースウィンドウを今の仮想デスクトップへ移しました');
    return;
  }
  if (isWorkspaceWindowVisible) {
    hideWorkspaceWindow();
  } else {
    await showWorkspaceWindow();
  }
}

/** ワークスペースウィンドウのピン留めの段階を変える（2＝常に最前面のときだけ最前面にする） */
export function setWorkspacePinLevel(level: PinLevel): PinLevel {
  workspacePinLevel = level;
  persistWorkspaceWindowState();
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    workspaceWindow.setAlwaysOnTop(level === 2);
    // setAlwaysOnTop で仮想デスクトップへの固定が外れるので当て直す
    void applyVisibilityOnAllDesktops();
    windowLogger.info(`ワークスペースウィンドウのピン留め: ${level}`);
  }
  return level;
}

/** ワークスペースウィンドウのピン留めの段階 */
export function getWorkspacePinLevel(): PinLevel {
  return workspacePinLevel;
}

/** 常に最前面に切り替える前の段階（編集画面の「試しに実行」が一時的に最前面にして戻すため） */
let pinLevelBeforeAlwaysOnTop: PinLevel = 0;

/** 常に最前面のオン・オフを切り替える（編集画面の「試しに実行」用。元の段階に戻せる） */
export function toggleWorkspaceAlwaysOnTop(): boolean {
  if (workspacePinLevel === 2) {
    setWorkspacePinLevel(pinLevelBeforeAlwaysOnTop);
    return false;
  }
  pinLevelBeforeAlwaysOnTop = workspacePinLevel;
  setWorkspacePinLevel(2);
  return true;
}

/** 常に最前面かどうか（編集画面の「試しに実行」用） */
export function getWorkspaceAlwaysOnTop(): boolean {
  return workspacePinLevel === 2;
}

/**
 * ピン留めしたワークスペースを、フォーカスを奪わずに手前へ出す（ホットキーでメインウィンドウを出すとき）
 */
export function bringPinnedWorkspaceToFront(): void {
  if (!workspaceWindow || workspaceWindow.isDestroyed()) return;
  if (workspacePinLevel === 0 || !workspaceWindow.isVisible()) return;
  workspaceWindow.moveTop();
}

/** 指定インデックスのディスプレイを取得（MAIN_WINDOW_DISPLAY_INDEX はメインウィンドウと同じディスプレイ、範囲外はプライマリ） */
function getDisplayByIndex(displayIndex: number): Display {
  if (displayIndex === MAIN_WINDOW_DISPLAY_INDEX) {
    return getMainWindowDisplay();
  }
  const displays = screen.getAllDisplays();
  if (displayIndex >= 0 && displayIndex < displays.length) {
    return displays[displayIndex];
  }
  windowLogger.warn(
    `指定ディスプレイ(${displayIndex})が範囲外のため、プライマリディスプレイを使用`
  );
  return screen.getPrimaryDisplay();
}

/** プライマリディスプレイのインデックスを取得する */
function getPrimaryDisplayIndex(): number {
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  return displays.findIndex((d) => d.id === primaryDisplay.id);
}

/** ワークスペースウィンドウを指定されたモードに応じた位置に配置する */
export async function setWorkspacePosition(mode?: WorkspacePositionMode): Promise<void> {
  if (!workspaceWindow || workspaceWindow.isDestroyed()) return;

  const settingsService = await SettingsService.getInstance();
  const positionMode = mode || (await settingsService.get('workspacePositionMode'));
  const bounds = workspaceWindow.getBounds();

  switch (positionMode) {
    case 'primaryLeft':
    case 'primaryRight':
    case 'displayLeft':
    case 'displayRight': {
      // primaryLeft/primaryRight は後方互換性のためプライマリディスプレイを使用
      const isPrimaryMode = positionMode === 'primaryLeft' || positionMode === 'primaryRight';
      const targetIndex = isPrimaryMode
        ? getPrimaryDisplayIndex()
        : await settingsService.get('workspaceTargetDisplayIndex');
      const targetDisplay = getDisplayByIndex(targetIndex);
      const workArea = targetDisplay.workArea;
      const isLeft = positionMode === 'primaryLeft' || positionMode === 'displayLeft';
      const width = Math.min(bounds.width, workArea.width);
      const x = isLeft ? workArea.x : workArea.x + workArea.width - width;
      // 高さはそのディスプレイの作業領域に合わせる（高さの違うモニターを行き来しても縮んだままにしない）
      setBoundsAcrossDisplays(workspaceWindow, {
        x,
        y: workArea.y,
        width,
        height: workArea.height,
      });
      const side = isLeft ? '左' : '右';
      const target =
        targetIndex === MAIN_WINDOW_DISPLAY_INDEX
          ? 'メインウィンドウと同じディスプレイ'
          : `ディスプレイ${targetIndex + 1}`;
      windowLogger.info(`ワークスペースを${target}の${side}端に配置`);
      break;
    }

    case 'fixed': {
      const savedX = await settingsService.get('workspacePositionX');
      const savedY = await settingsService.get('workspacePositionY');
      const primaryWorkArea = screen.getPrimaryDisplay().workArea;
      const isFirstLaunch = savedX === 0 && savedY === 0;
      const needsFallback = !isFirstLaunch && !isPositionOnScreen(savedX, savedY);

      if (isFirstLaunch || needsFallback) {
        if (needsFallback) {
          windowLogger.warn('保存位置が画面外のため右端に配置');
        }
        const clampedHeight = Math.min(bounds.height, primaryWorkArea.height);
        workspaceWindow.setBounds({
          x: primaryWorkArea.width - bounds.width,
          y: 0,
          width: bounds.width,
          height: clampedHeight,
        });
        const newBounds = workspaceWindow.getBounds();
        await settingsService.set('workspacePositionX', newBounds.x);
        await settingsService.set('workspacePositionY', newBounds.y);
        if (isFirstLaunch) {
          windowLogger.info('初回起動: ワークスペースを右端に配置');
        }
      } else {
        workspaceWindow.setPosition(savedX, savedY);
        windowLogger.info(`ワークスペースを固定位置に配置: (${savedX}, ${savedY})`);
      }
      break;
    }
  }
}

/** 現在のワークスペースウィンドウ位置を保存する（fixedモード時のみ） */
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

/** ワークスペースウィンドウのインスタンスを取得する */
export function getWorkspaceWindow(): BrowserWindow | null {
  return workspaceWindow;
}

/** ウィンドウスナップの有効/無効キャッシュを更新する */
export function setWindowSnapEnabled(enabled: boolean): void {
  windowSnapEnabled = enabled;
}

/**
 * ワークスペースウィンドウの全仮想デスクトップ表示設定を適用
 */
export async function applyVisibilityOnAllDesktops(): Promise<void> {
  if (!workspaceWindow || workspaceWindow.isDestroyed()) return;

  const settingsService = await SettingsService.getInstance();
  const enabled = await settingsService.get('workspaceVisibleOnAllDesktops');
  const hwnd = workspaceWindow.getNativeWindowHandle().readBigUInt64LE();
  const success = enabled ? pinWindow(hwnd) : unPinWindow(hwnd);
  const action = enabled ? 'pin' : 'unpin';
  if (success) {
    windowLogger.info(`ワークスペースの仮想デスクトップ固定: ${action}`);
  } else {
    windowLogger.warn(`ワークスペースの仮想デスクトップ固定に失敗: ${action}`);
  }
}
