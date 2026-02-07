import * as path from 'path';

import { BrowserWindow, Display, screen } from 'electron';
import { windowLogger } from '@common/logger';
import type { WorkspacePositionMode } from '@common/types';

import { SettingsService } from './services/settingsService.js';
import { EnvConfig } from './config/envConfig.js';
import PathManager from './config/pathManager.js';
import { calculateModalSize } from './utils/modalSizeManager.js';
import { pinWindow, unPinWindow } from './utils/virtualDesktop/index.js';

let workspaceWindow: BrowserWindow | null = null;
let isWorkspaceWindowVisible: boolean = false;
let isAppQuitting: boolean = false;
let isWorkspacePinned: boolean = false;
let normalWorkspaceWindowBounds: { width: number; height: number } | null = null;

/**
 * ワークスペースウィンドウを作成し、初期設定を行う
 */
export async function createWorkspaceWindow(): Promise<BrowserWindow> {
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    workspaceWindow.show();
    workspaceWindow.focus();
    isWorkspaceWindowVisible = true;
    return workspaceWindow;
  }

  const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 380;
  const windowHeight = screenHeight;

  const settingsService = await SettingsService.getInstance();
  const opacity = await settingsService.get('workspaceOpacity');
  const backgroundTransparent = await settingsService.get('workspaceBackgroundTransparent');
  const opacityValue = backgroundTransparent ? 1.0 : Math.max(0, Math.min(100, opacity)) / 100;

  workspaceWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    alwaysOnTop: false,
    frame: false,
    show: false,
    resizable: false,
    icon: PathManager.getAppIconPath(),
    transparent: true,
    opacity: opacityValue,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (EnvConfig.isDevelopment) {
    workspaceWindow.loadURL(`${EnvConfig.devServerUrl}/workspace.html`);
  } else {
    workspaceWindow.loadFile(path.join(__dirname, '../workspace.html'));
  }

  workspaceWindow.setMenuBarVisibility(false);
  workspaceWindow.setMenu(null);
  workspaceWindow.setIgnoreMouseEvents(false);

  workspaceWindow.on('close', (event) => {
    if (!isAppQuitting) {
      event.preventDefault();
      workspaceWindow?.hide();
      isWorkspaceWindowVisible = false;
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

  workspaceWindow.webContents.on('before-input-event', (event, input) => {
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
      workspaceWindow?.webContents.toggleDevTools();
    }
  });

  workspaceWindow.on('moved', () => {
    void saveWorkspacePosition();
  });

  await setWorkspacePosition();

  workspaceWindow.once('show', () => {
    void applyVisibilityOnAllDesktops();
  });

  windowLogger.info('ワークスペースウィンドウを作成しました');
  return workspaceWindow;
}

/**
 * ワークスペースウィンドウを表示する（存在しない場合は新規作成）
 */
export async function showWorkspaceWindow(options?: { skipFocus?: boolean }): Promise<void> {
  try {
    if (!workspaceWindow || workspaceWindow.isDestroyed()) {
      await createWorkspaceWindow();
    }

    if (workspaceWindow) {
      await setWorkspacePosition();
      workspaceWindow.show();
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

/** ワークスペースウィンドウを非表示にする */
export function hideWorkspaceWindow(): void {
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    workspaceWindow.hide();
    isWorkspaceWindowVisible = false;
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
  if (isWorkspaceWindowVisible) {
    hideWorkspaceWindow();
  } else {
    await showWorkspaceWindow();
  }
}

/** ワークスペースウィンドウの表示状態を取得する */
export function isWorkspaceWindowShown(): boolean {
  return isWorkspaceWindowVisible;
}

/** アプリケーション終了フラグを設定する */
export function setAppQuitting(quitting: boolean): void {
  isAppQuitting = quitting;
}

/** ワークスペースウィンドウのピン留め状態を設定する */
export function setWorkspaceAlwaysOnTop(isPinned: boolean): void {
  isWorkspacePinned = isPinned;
  if (workspaceWindow && !workspaceWindow.isDestroyed()) {
    workspaceWindow.setAlwaysOnTop(isPinned);
    windowLogger.info(`ワークスペースウィンドウのピン留め: ${isPinned ? 'ON' : 'OFF'}`);
  }
}

/** ワークスペースウィンドウのピン留め状態をトグルする */
export function toggleWorkspaceAlwaysOnTop(): boolean {
  const newState = !isWorkspacePinned;
  setWorkspaceAlwaysOnTop(newState);
  return newState;
}

/** ワークスペースウィンドウの現在のピン留め状態を取得する */
export function getWorkspaceAlwaysOnTop(): boolean {
  return isWorkspacePinned;
}

/**
 * ワークスペースウィンドウのモーダルモードを切り替え
 * モーダル表示時はサイズを拡大し、閉じる時は元のサイズに戻す
 */
export function setWorkspaceModalMode(
  isModal: boolean,
  requiredSize?: { width: number; height: number }
): void {
  if (!workspaceWindow || workspaceWindow.isDestroyed()) return;

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const currentBounds = workspaceWindow.getBounds();

  if (isModal && requiredSize) {
    if (!normalWorkspaceWindowBounds) {
      normalWorkspaceWindowBounds = { width: currentBounds.width, height: currentBounds.height };
    }

    const { needsResize, newSize } = calculateModalSize(currentBounds, requiredSize);
    if (needsResize) {
      workspaceWindow.setBounds({
        x: screenWidth - newSize.width,
        y: currentBounds.y,
        width: newSize.width,
        height: newSize.height,
      });
      windowLogger.info(
        `モーダルモードON: ${currentBounds.width}x${currentBounds.height} -> ${newSize.width}x${newSize.height}`
      );
    }
  } else if (normalWorkspaceWindowBounds) {
    workspaceWindow.setBounds({
      x: screenWidth - normalWorkspaceWindowBounds.width,
      y: currentBounds.y,
      width: normalWorkspaceWindowBounds.width,
      height: normalWorkspaceWindowBounds.height,
    });
    windowLogger.info(
      `モーダルモードOFF: ${normalWorkspaceWindowBounds.width}x${normalWorkspaceWindowBounds.height}に復元`
    );
    normalWorkspaceWindowBounds = null;
  }
}

/** 指定インデックスのディスプレイを取得（範囲外はプライマリ） */
function getDisplayByIndex(displayIndex: number): Display {
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

/** 指定座標がいずれかのディスプレイ内にあるか確認 */
function isPositionOnScreen(x: number, y: number): boolean {
  return screen.getAllDisplays().some((display) => {
    const wb = display.workArea;
    return x >= wb.x && x < wb.x + wb.width && y >= wb.y && y < wb.y + wb.height;
  });
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
      const x = isLeft ? workArea.x : workArea.x + workArea.width - bounds.width;
      workspaceWindow.setPosition(x, workArea.y);
      workspaceWindow.setSize(bounds.width, workArea.height);
      const side = isLeft ? '左' : '右';
      windowLogger.info(`ワークスペースをディスプレイ${targetIndex + 1}の${side}端に配置`);
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
        workspaceWindow.setPosition(primaryWorkArea.width - bounds.width, 0);
        workspaceWindow.setSize(bounds.width, primaryWorkArea.height);
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

/**
 * ワークスペースウィンドウの全仮想デスクトップ表示設定を適用
 */
export async function applyVisibilityOnAllDesktops(): Promise<void> {
  if (!workspaceWindow || workspaceWindow.isDestroyed()) {
    return;
  }

  const settingsService = await SettingsService.getInstance();
  const enabled = await settingsService.get('workspaceVisibleOnAllDesktops');

  const hwnd = workspaceWindow.getNativeWindowHandle().readBigUInt64LE();
  const action = enabled ? 'pin' : 'unpin';
  const success = enabled ? pinWindow(hwnd) : unPinWindow(hwnd);

  if (success) {
    windowLogger.info(`ワークスペースの仮想デスクトップ固定: ${action}`);
  } else {
    windowLogger.warn(`ワークスペースの仮想デスクトップ固定に失敗: ${action}`);
  }
}
