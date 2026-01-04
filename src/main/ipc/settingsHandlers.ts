import { ipcMain, BrowserWindow } from 'electron';
import type { AppSettings } from '@common/types.js';
import logger from '@common/logger.js';

import { SettingsService } from '../services/settingsService.js';
import { HotkeyService } from '../services/hotkeyService.js';
import { AutoLaunchService } from '../services/autoLaunchService.js';
import { getIsFirstLaunch } from '../main.js';

/**
 * すべてのウィンドウに設定変更を通知
 */
function notifySettingsChanged() {
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach((window) => {
    window.webContents.send('settings-changed');
  });
}

/**
 * 設定関連のIPCハンドラーを登録
 */
export function setupSettingsHandlers(setFirstLaunchMode?: (isFirstLaunch: boolean) => void): void {
  // 初回起動かどうかを取得
  ipcMain.handle('settings:is-first-launch', async () => {
    const isFirstLaunch = getIsFirstLaunch();
    logger.info(`Is first launch request: ${isFirstLaunch}`);
    return isFirstLaunch;
  });
  // 設定値を取得
  ipcMain.handle('settings:get', async (_event, key?: keyof AppSettings) => {
    try {
      const settingsService = await SettingsService.getInstance();
      if (key) {
        const value = await settingsService.get(key);
        logger.info(`Settings get request: ${key} = ${value}`);
        return value;
      } else {
        const allSettings = await settingsService.getAll();
        logger.info('Settings get all request');
        return allSettings;
      }
    } catch (error) {
      logger.error({ error }, 'Failed to get settings');
      throw error;
    }
  });

  // 設定値を設定
  ipcMain.handle(
    'settings:set',
    async (_event, key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => {
      try {
        const settingsService = await SettingsService.getInstance();
        await settingsService.set(key, value);
        logger.info(`Settings set request: ${key} = ${value}`);

        // autoLaunch設定の場合、システムの自動起動設定を更新
        if (key === 'autoLaunch') {
          const autoLaunchService = AutoLaunchService.getInstance();
          await autoLaunchService.setAutoLaunch(value as boolean);
        }

        // workspaceOpacity または workspaceBackgroundTransparent 設定の場合、ワークスペースウィンドウの透過度を即座に反映
        if (key === 'workspaceOpacity' || key === 'workspaceBackgroundTransparent') {
          const { getWorkspaceWindow } = await import('../workspaceWindowManager.js');
          const workspace = getWorkspaceWindow();
          if (workspace && !workspace.isDestroyed()) {
            // 現在の設定を取得
            const currentSettings = await settingsService.getAll();
            const backgroundTransparent =
              key === 'workspaceBackgroundTransparent'
                ? (value as boolean)
                : currentSettings.workspaceBackgroundTransparent;
            const opacity =
              key === 'workspaceOpacity' ? (value as number) : currentSettings.workspaceOpacity;

            // 背景のみ透過の場合はウィンドウは完全不透明、それ以外は設定値を使用
            workspace.setOpacity(backgroundTransparent ? 1.0 : opacity / 100);
          }
        }

        return true;
      } catch (error) {
        logger.error({ error, key }, 'Failed to set setting');
        throw error;
      }
    }
  );

  // 複数の設定値を一括設定
  ipcMain.handle('settings:set-multiple', async (_event, settings: Partial<AppSettings>) => {
    try {
      const settingsService = await SettingsService.getInstance();
      await settingsService.setMultiple(settings);
      logger.info({ settings }, 'Settings set multiple request');

      // ホットキーが設定された場合、初回起動モードを解除
      if (settings.hotkey && settings.hotkey.trim() !== '' && setFirstLaunchMode) {
        setFirstLaunchMode(false);
        logger.info('初回起動モードを解除しました（ホットキーが設定されたため）');
      }

      // autoLaunch設定が含まれている場合、システムの自動起動設定を更新
      if (settings.autoLaunch !== undefined) {
        const autoLaunchService = AutoLaunchService.getInstance();
        await autoLaunchService.setAutoLaunch(settings.autoLaunch);
      }

      // workspaceOpacity設定が含まれている場合、ワークスペースウィンドウの透過度を即座に反映
      if (
        settings.workspaceOpacity !== undefined ||
        settings.workspaceBackgroundTransparent !== undefined
      ) {
        const { getWorkspaceWindow } = await import('../workspaceWindowManager.js');
        const workspace = getWorkspaceWindow();
        if (workspace && !workspace.isDestroyed()) {
          // 現在の設定を取得
          const currentSettings = await settingsService.getAll();
          const backgroundTransparent =
            settings.workspaceBackgroundTransparent ??
            currentSettings.workspaceBackgroundTransparent;
          const opacity = settings.workspaceOpacity ?? currentSettings.workspaceOpacity;

          // 背景のみ透過の場合はウィンドウは完全不透明、それ以外は設定値を使用
          workspace.setOpacity(backgroundTransparent ? 1.0 : opacity / 100);
        }
      }

      // すべてのウィンドウに設定変更を通知
      notifySettingsChanged();

      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to set multiple settings');
      throw error;
    }
  });

  // 設定をリセット
  ipcMain.handle('settings:reset', async (_event) => {
    try {
      const settingsService = await SettingsService.getInstance();
      await settingsService.reset();
      logger.info('Settings reset request');

      // 自動起動もリセット（デフォルトはfalse）
      const autoLaunchService = AutoLaunchService.getInstance();
      await autoLaunchService.setAutoLaunch(false);

      // すべてのウィンドウに設定変更を通知
      notifySettingsChanged();

      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to reset settings');
      throw error;
    }
  });

  // ホットキーの妥当性を検証
  ipcMain.handle('settings:validate-hotkey', async (_event, hotkey: string) => {
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

  // 設定ファイルのパスを取得
  ipcMain.handle('settings:get-config-path', async (_event) => {
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

  // ホットキーを変更
  ipcMain.handle('settings:change-hotkey', async (_event, newHotkey: string) => {
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

  // ホットキーの利用可能性をチェック
  ipcMain.handle('settings:check-hotkey-availability', async (_event, hotkey: string) => {
    try {
      const hotkeyService = HotkeyService.getInstance();
      const isAvailable = hotkeyService.isHotkeyAvailable(hotkey);
      logger.info(`Hotkey availability check: ${hotkey} = ${isAvailable}`);
      return isAvailable;
    } catch (error) {
      logger.error({ error, hotkey }, 'Failed to check hotkey availability');
      throw error;
    }
  });

  logger.info('Settings IPC handlers registered');
}
