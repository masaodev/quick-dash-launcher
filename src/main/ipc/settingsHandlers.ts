import { ipcMain, BrowserWindow, screen } from 'electron';
import type { AppSettings, DisplayInfo } from '@common/types';
import logger from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { SettingsService } from '../services/settingsService.js';
import { HotkeyService } from '../services/hotkeyService.js';
import { AutoLaunchService } from '../services/autoLaunchService.js';
import {
  getWorkspaceWindow,
  setWorkspacePosition,
  applyVisibilityOnAllDesktops,
  setWindowSnapEnabled,
} from '../workspaceWindowManager.js';
import {
  setDetachedWindowSnapEnabled,
  applyDetachedVisibilityOnAllDesktops,
} from '../detachedGroupWindowManager.js';
import { EnvConfig } from '../config/envConfig.js';
import { showToastWindow } from '../services/overlayWindowService.js';

function notifySettingsChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IPC_CHANNELS.EVENT_SETTINGS_CHANGED);
  }
}

const OPACITY_KEYS: ReadonlyArray<keyof AppSettings> = [
  'workspaceOpacity',
  'workspaceBackgroundTransparent',
];

const POSITION_KEYS: ReadonlyArray<keyof AppSettings> = [
  'workspacePositionMode',
  'workspaceTargetDisplayIndex',
  'workspacePositionX',
  'workspacePositionY',
];

/** 副作用（OS 登録・ウィンドウ状態）を持つ設定キー。ファイル再読込時に全部適用し直す */
const EFFECT_KEYS: ReadonlyArray<keyof AppSettings> = [
  'autoLaunch',
  ...OPACITY_KEYS,
  ...POSITION_KEYS,
  'workspaceVisibleOnAllDesktops',
  'detachedVisibleOnAllDesktops',
  'windowSnapEnabled',
];

async function applySettingsEffects(
  changedKeys: ReadonlyArray<keyof AppSettings>,
  settingsService: SettingsService
): Promise<void> {
  if (changedKeys.includes('autoLaunch')) {
    const autoLaunch = await settingsService.get('autoLaunch');
    await AutoLaunchService.getInstance().setAutoLaunch(autoLaunch);
  }

  if (changedKeys.some((key) => OPACITY_KEYS.includes(key))) {
    const workspace = getWorkspaceWindow();
    if (workspace && !workspace.isDestroyed()) {
      const [backgroundTransparent, opacity] = await Promise.all([
        settingsService.get('workspaceBackgroundTransparent'),
        settingsService.get('workspaceOpacity'),
      ]);
      workspace.setOpacity(backgroundTransparent ? 1.0 : opacity / 100);
    }
  }

  if (changedKeys.some((key) => POSITION_KEYS.includes(key))) {
    const workspace = getWorkspaceWindow();
    if (workspace && !workspace.isDestroyed() && workspace.isVisible()) {
      await setWorkspacePosition();
    }
  }

  if (changedKeys.includes('workspaceVisibleOnAllDesktops')) {
    await applyVisibilityOnAllDesktops();
  }

  if (changedKeys.includes('detachedVisibleOnAllDesktops')) {
    await applyDetachedVisibilityOnAllDesktops();
  }

  if (changedKeys.includes('windowSnapEnabled')) {
    const enabled = await settingsService.get('windowSnapEnabled');
    setWindowSnapEnabled(enabled);
    setDetachedWindowSnapEnabled(enabled);
  }
}

/**
 * 登録に失敗したホットキー値（type 別）。同じ値で失敗し続ける間はトーストを繰り返さない
 * （F5 のたびにエラーが出続けるのを防ぐ。値が変われば改めて知らせる）
 */
const lastFailedHotkey: Record<'main' | 'itemSearch', string | null> = {
  main: null,
  itemSearch: null,
};

/**
 * ホットキー設定をディスクの値に合わせて登録し直す
 *
 * 値が現在の登録と同じなら何もしない。登録に失敗した場合は設定を書き戻さず、
 * 現在の登録を維持してトーストで知らせる（外部で書かれた値を勝手に消さない）。
 */
async function reapplyHotkey(
  type: 'main' | 'itemSearch',
  settingsService: SettingsService
): Promise<void> {
  const hotkeyService = HotkeyService.getInstance();
  const isMain = type === 'main';

  // 環境変数で上書きされている間は settings.json の値を使わない
  if (isMain && EnvConfig.customHotkey) return;

  const desired = (await settingsService.get(isMain ? 'hotkey' : 'itemSearchHotkey')) ?? '';
  const current =
    (isMain ? hotkeyService.getCurrentHotkey() : hotkeyService.getCurrentItemSearchHotkey()) ?? '';
  if (desired === current) return;

  const label = isMain ? 'ホットキー' : 'ウィンドウ検索ホットキー';

  if (desired.trim() === '') {
    if (isMain) {
      logger.warn('settings.json のホットキーが空のため、現在の登録を維持します');
      return;
    }
    hotkeyService.unregisterItemSearchHotkey();
    logger.info(`${label}を解除しました（settings.json で空）`);
    return;
  }

  const validation = settingsService.validateHotkey(desired);
  const success =
    validation.isValid &&
    (isMain ? hotkeyService.setHotkey(desired) : hotkeyService.setItemSearchHotkey(desired));

  if (success) {
    lastFailedHotkey[type] = null;
    logger.info(`${label}を settings.json の値に合わせて登録し直しました: ${desired}`);
    return;
  }

  // 失敗時は元の登録に戻す
  if (current) {
    if (isMain) hotkeyService.setHotkey(current);
    else hotkeyService.setItemSearchHotkey(current);
  }
  const reason = validation.isValid ? '他のアプリで使用中の可能性' : validation.reason;
  logger.warn({ desired, current, reason }, `${label}の登録し直しに失敗しました`);

  if (lastFailedHotkey[type] === desired) return;
  lastFailedHotkey[type] = desired;
  showToastWindow({
    message: `${label}「${desired}」を登録できません（${reason}）。「${current || '未設定'}」を維持します`,
    type: 'error',
    duration: 6000,
  }).catch((error) => logger.error({ error }, 'ホットキー再登録トーストの表示に失敗'));
}

/**
 * settings.json をディスクから読み直し、副作用のある設定を適用し直す
 *
 * 設定値そのものは electron-store が毎回ディスクを読むので常に最新だが、
 * ホットキー登録・自動起動・ウィンドウ状態は set() 時にしか適用されない。
 * QDL 外（人・AI）で settings.json を編集したときに、F5 でそれらを効かせる入口。
 */
export async function reapplySettingsFromDisk(): Promise<void> {
  const settingsService = await SettingsService.getInstance();

  await applySettingsEffects(EFFECT_KEYS, settingsService);
  await reapplyHotkey('main', settingsService);
  await reapplyHotkey('itemSearch', settingsService);

  notifySettingsChanged();
  logger.info('設定をディスクから再適用しました');
}

export function setupSettingsHandlers(setFirstLaunchMode?: (isFirstLaunch: boolean) => void): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_IS_FIRST_LAUNCH, async () => {
    const settingsService = await SettingsService.getInstance();
    const hotkey = await settingsService.get('hotkey');
    const isFirstLaunch = !hotkey || hotkey.trim() === '';
    logger.info(`Is first launch request: ${isFirstLaunch}`);
    return isFirstLaunch;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_event, key?: keyof AppSettings) => {
    const settingsService = await SettingsService.getInstance();
    if (key) {
      const value = await settingsService.get(key);
      logger.info(`Settings get request: ${key} = ${value}`);
      return value;
    }
    const allSettings = await settingsService.getAll();
    logger.info('Settings get all request');
    return allSettings;
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET_MULTIPLE,
    async (_event, settings: Partial<AppSettings>) => {
      const settingsService = await SettingsService.getInstance();
      await settingsService.setMultiple(settings);
      logger.info({ settings }, 'Settings set multiple request');

      if (settings.hotkey && settings.hotkey.trim() !== '' && setFirstLaunchMode) {
        setFirstLaunchMode(false);
        logger.info('初回起動モードを解除しました（ホットキーが設定されたため）');
      }

      const changedKeys = Object.keys(settings) as Array<keyof AppSettings>;
      await applySettingsEffects(changedKeys, settingsService);
      notifySettingsChanged();

      return true;
    }
  );

  ipcMain.handle(IPC_CHANNELS.SETTINGS_REAPPLY, () => reapplySettingsFromDisk());

  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, async () => {
    const settingsService = await SettingsService.getInstance();
    await settingsService.reset();
    logger.info('Settings reset request');
    await AutoLaunchService.getInstance().setAutoLaunch(false);
    notifySettingsChanged();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_VALIDATE_HOTKEY, async (_event, hotkey: string) => {
    const settingsService = await SettingsService.getInstance();
    const result = settingsService.validateHotkey(hotkey);
    logger.info(`Hotkey validation request: ${hotkey} = ${result.isValid}`);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_CHANGE_HOTKEY, async (_event, newHotkey: string) => {
    const success = await HotkeyService.getInstance().changeHotkey(newHotkey);
    logger.info(`Hotkey change request: ${newHotkey} = ${success ? 'success' : 'failed'}`);
    return success;
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_CHANGE_ITEM_SEARCH_HOTKEY,
    async (_event, newHotkey: string) => {
      const success = await HotkeyService.getInstance().changeItemSearchHotkey(newHotkey);
      logger.info(
        `Item search hotkey change request: ${newHotkey} = ${success ? 'success' : 'failed'}`
      );
      return success;
    }
  );

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_DISPLAYS, () => {
    const displays = screen.getAllDisplays();
    const primaryId = screen.getPrimaryDisplay().id;

    const displayInfos: DisplayInfo[] = displays.map((display, index) => {
      const isPrimary = display.id === primaryId;
      return {
        index,
        label: `ディスプレイ ${index + 1}${isPrimary ? ' (プライマリ)' : ''}`,
        isPrimary,
        width: display.workArea.width,
        height: display.workArea.height,
        x: display.workArea.x,
        y: display.workArea.y,
      };
    });

    logger.info({ displayCount: displayInfos.length }, 'ディスプレイ一覧を取得');
    return displayInfos;
  });

  logger.info('Settings IPC handlers registered');
}
