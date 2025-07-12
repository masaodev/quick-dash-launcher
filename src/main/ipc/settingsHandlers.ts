import { ipcMain } from 'electron';
import { AppSettings } from '../../common/types.js';
import { SettingsService } from '../services/settingsService.js';
import { HotkeyService } from '../services/hotkeyService.js';
import logger from '../../common/logger.js';

/**
 * 設定関連のIPCハンドラーを登録
 */
export function setupSettingsHandlers(): void {

  // 設定値を取得
  ipcMain.handle('settings:get', async (event, key?: keyof AppSettings) => {
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
      logger.error('Failed to get settings:', error);
      throw error;
    }
  });

  // 設定値を設定
  ipcMain.handle('settings:set', async (event, key: keyof AppSettings, value: any) => {
    try {
      const settingsService = await SettingsService.getInstance();
      await settingsService.set(key, value);
      logger.info(`Settings set request: ${key} = ${value}`);
      return true;
    } catch (error) {
      logger.error(`Failed to set setting ${key}:`, error);
      throw error;
    }
  });

  // 複数の設定値を一括設定
  ipcMain.handle('settings:set-multiple', async (event, settings: Partial<AppSettings>) => {
    try {
      const settingsService = await SettingsService.getInstance();
      await settingsService.setMultiple(settings);
      logger.info('Settings set multiple request:', settings);
      return true;
    } catch (error) {
      logger.error('Failed to set multiple settings:', error);
      throw error;
    }
  });

  // 設定をリセット
  ipcMain.handle('settings:reset', async (event) => {
    try {
      const settingsService = await SettingsService.getInstance();
      await settingsService.reset();
      logger.info('Settings reset request');
      return true;
    } catch (error) {
      logger.error('Failed to reset settings:', error);
      throw error;
    }
  });

  // ホットキーの妥当性を検証
  ipcMain.handle('settings:validate-hotkey', async (event, hotkey: string) => {
    try {
      const settingsService = await SettingsService.getInstance();
      const result = settingsService.validateHotkey(hotkey);
      logger.info(`Hotkey validation request: ${hotkey} = ${result.isValid}`);
      return result;
    } catch (error) {
      logger.error('Failed to validate hotkey:', error);
      throw error;
    }
  });

  // 設定ファイルのパスを取得
  ipcMain.handle('settings:get-config-path', async (event) => {
    try {
      const settingsService = await SettingsService.getInstance();
      const path = await settingsService.getConfigPath();
      logger.info(`Settings config path request: ${path}`);
      return path;
    } catch (error) {
      logger.error('Failed to get config path:', error);
      throw error;
    }
  });

  // ホットキーを変更
  ipcMain.handle('settings:change-hotkey', async (event, newHotkey: string) => {
    try {
      const hotkeyService = HotkeyService.getInstance();
      const success = await hotkeyService.changeHotkey(newHotkey);
      logger.info(`Hotkey change request: ${newHotkey} = ${success ? 'success' : 'failed'}`);
      return success;
    } catch (error) {
      logger.error(`Failed to change hotkey to ${newHotkey}:`, error);
      throw error;
    }
  });

  // ホットキーの利用可能性をチェック
  ipcMain.handle('settings:check-hotkey-availability', async (event, hotkey: string) => {
    try {
      const hotkeyService = HotkeyService.getInstance();
      const isAvailable = hotkeyService.isHotkeyAvailable(hotkey);
      logger.info(`Hotkey availability check: ${hotkey} = ${isAvailable}`);
      return isAvailable;
    } catch (error) {
      logger.error(`Failed to check hotkey availability ${hotkey}:`, error);
      throw error;
    }
  });

  logger.info('Settings IPC handlers registered');
}