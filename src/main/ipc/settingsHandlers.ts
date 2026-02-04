import { ipcMain, BrowserWindow, screen } from 'electron';
import type { AppSettings, DisplayInfo } from '@common/types';
import logger from '@common/logger';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { SettingsService } from '../services/settingsService.js';
import { HotkeyService } from '../services/hotkeyService.js';
import { AutoLaunchService } from '../services/autoLaunchService.js';
import { getWorkspaceWindow, setWorkspacePosition } from '../workspaceWindowManager.js';

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

/**
 * 設定変更の副作用を適用する
 */
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
    try {
      const settingsService = await SettingsService.getInstance();
      if (key) {
        const value = await settingsService.get(key);
        logger.info(`Settings get request: ${key} = ${value}`);
        return value;
      }
      const allSettings = await settingsService.getAll();
      logger.info('Settings get all request');
      return allSettings;
    } catch (error) {
      logger.error({ error }, 'Failed to get settings');
      throw error;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    async (_event, key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => {
      try {
        const settingsService = await SettingsService.getInstance();
        await settingsService.set(key, value);
        logger.info(`Settings set request: ${key} = ${value}`);
        await applySettingsEffects([key], settingsService);
        return true;
      } catch (error) {
        logger.error({ error, key }, 'Failed to set setting');
        throw error;
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET_MULTIPLE,
    async (_event, settings: Partial<AppSettings>) => {
      try {
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
      } catch (error) {
        logger.error({ error }, 'Failed to set multiple settings');
        throw error;
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, async () => {
    try {
      const settingsService = await SettingsService.getInstance();
      await settingsService.reset();
      logger.info('Settings reset request');
      await AutoLaunchService.getInstance().setAutoLaunch(false);
      notifySettingsChanged();
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to reset settings');
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_VALIDATE_HOTKEY, async (_event, hotkey: string) => {
    try {
      const settingsService = await SettingsService.getInstance();
      const result = settingsService.validateHotkey(hotkey);
      logger.info(`Hotkey validation request: ${hotkey} = ${result.isValid}`);
      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to validate hotkey');
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_CONFIG_PATH, async () => {
    try {
      const settingsService = await SettingsService.getInstance();
      const path = await settingsService.getConfigPath();
      logger.info(`Settings config path request: ${path}`);
      return path;
    } catch (error) {
      logger.error({ error }, 'Failed to get config path');
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_CHANGE_HOTKEY, async (_event, newHotkey: string) => {
    try {
      const hotkeyService = HotkeyService.getInstance();
      const success = await hotkeyService.changeHotkey(newHotkey);
      logger.info(`Hotkey change request: ${newHotkey} = ${success ? 'success' : 'failed'}`);
      return success;
    } catch (error) {
      logger.error({ error, newHotkey }, 'Failed to change hotkey');
      throw error;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_CHECK_HOTKEY_AVAILABILITY,
    async (_event, hotkey: string) => {
      try {
        const isAvailable = HotkeyService.getInstance().isHotkeyAvailable(hotkey);
        logger.info(`Hotkey availability check: ${hotkey} = ${isAvailable}`);
        return isAvailable;
      } catch (error) {
        logger.error({ error, hotkey }, 'Failed to check hotkey availability');
        throw error;
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_CHANGE_ITEM_SEARCH_HOTKEY,
    async (_event, newHotkey: string) => {
      try {
        const success = await HotkeyService.getInstance().changeItemSearchHotkey(newHotkey);
        logger.info(
          `Item search hotkey change request: ${newHotkey} = ${success ? 'success' : 'failed'}`
        );
        return success;
      } catch (error) {
        logger.error({ error, newHotkey }, 'Failed to change item search hotkey');
        throw error;
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_DISPLAYS, async () => {
    try {
      const displays = screen.getAllDisplays();
      const primaryDisplay = screen.getPrimaryDisplay();

      const displayInfos: DisplayInfo[] = displays.map((display, index) => {
        const isPrimary = display.id === primaryDisplay.id;
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
    } catch (error) {
      logger.error({ error }, 'ディスプレイ一覧の取得に失敗');
      throw error;
    }
  });

  logger.info('Settings IPC handlers registered');
}
