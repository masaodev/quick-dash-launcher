import { globalShortcut, BrowserWindow } from 'electron';
import logger from '@common/logger';

import { EnvConfig } from '../config/envConfig.js';

import { SettingsService } from './settingsService.js';

/** ホットキーの種別 */
type HotkeyType = 'main' | 'itemSearch';

/**
 * ホットキー管理サービス
 * 動的なホットキーの登録・解除・変更を管理
 */
export class HotkeyService {
  private static instance: HotkeyService;
  private settingsService!: SettingsService;
  private currentHotkey: string | null = null;
  private currentItemSearchHotkey: string | null = null;
  private getMainWindow: () => BrowserWindow | null;
  private showWindowCallback: (startTime?: number) => Promise<void>;
  private hideWindowCallback: () => Promise<void>;
  private showItemSearchCallback: ((startTime?: number) => Promise<void>) | null = null;

  private constructor(
    getMainWindow: () => BrowserWindow | null,
    showWindowCallback: (startTime?: number) => Promise<void>,
    hideWindowCallback: () => Promise<void>
  ) {
    this.getMainWindow = getMainWindow;
    this.showWindowCallback = showWindowCallback;
    this.hideWindowCallback = hideWindowCallback;
  }

  /**
   * アイテム検索モード直接起動のコールバックを設定
   */
  public setItemSearchCallback(callback: (startTime?: number) => Promise<void>): void {
    this.showItemSearchCallback = callback;
  }

  /**
   * SettingsServiceを初期化
   */
  private async initializeSettingsService(): Promise<void> {
    if (!this.settingsService) {
      this.settingsService = await SettingsService.getInstance();
    }
  }

  /**
   * HotkeyServiceのシングルトンインスタンスを取得
   */
  public static getInstance(
    getMainWindow?: () => BrowserWindow | null,
    showWindowCallback?: (startTime?: number) => Promise<void>,
    hideWindowCallback?: () => Promise<void>
  ): HotkeyService {
    if (!HotkeyService.instance) {
      if (!getMainWindow || !showWindowCallback || !hideWindowCallback) {
        throw new Error(
          'HotkeyService requires getMainWindow, showWindowCallback, and hideWindowCallback on first initialization'
        );
      }
      HotkeyService.instance = new HotkeyService(
        getMainWindow,
        showWindowCallback,
        hideWindowCallback
      );
    }
    return HotkeyService.instance;
  }

  /**
   * 設定からホットキーを読み込んで登録
   * 環境変数HOTKEYが設定されている場合は、それを優先
   */
  public async registerHotkey(): Promise<boolean> {
    try {
      await this.initializeSettingsService();

      // 環境変数が設定されている場合は優先
      const envHotkey = EnvConfig.customHotkey;
      const hotkey = envHotkey || (await this.settingsService.get('hotkey'));

      if (envHotkey) {
        logger.info(`Using hotkey from environment variable: ${envHotkey}`);
      }

      const mainSuccess = this.setHotkey(hotkey);

      // アイテム検索ホットキーも登録
      const itemSearchHotkey = await this.settingsService.get('itemSearchHotkey');
      const itemSearchSuccess = this.setItemSearchHotkey(itemSearchHotkey);

      return mainSuccess && itemSearchSuccess;
    } catch (error) {
      logger.error({ error }, 'Failed to register hotkey from settings');
      return false;
    }
  }

  /**
   * ホットキーを解除する共通処理
   */
  private unregisterHotkeyInternal(type: HotkeyType): void {
    const hotkey = type === 'main' ? this.currentHotkey : this.currentItemSearchHotkey;
    if (!hotkey) return;

    try {
      globalShortcut.unregister(hotkey);
      logger.info(`${type === 'main' ? 'Hotkey' : 'Item search hotkey'} unregistered: ${hotkey}`);
    } catch (error) {
      logger.error({ error, hotkey }, `Error unregistering ${type} hotkey`);
    }

    if (type === 'main') {
      this.currentHotkey = null;
    } else {
      this.currentItemSearchHotkey = null;
    }
  }

  /**
   * 指定されたホットキーを登録
   * @param hotkey 登録するホットキー
   * @returns 登録成功の可否
   */
  public setHotkey(hotkey: string): boolean {
    try {
      this.unregisterHotkeyInternal('main');

      if (!hotkey || hotkey.trim() === '') {
        logger.info('ホットキーが未設定のため、登録をスキップしました');
        return true;
      }

      const success = globalShortcut.register(hotkey, () => {
        this.handleHotkeyPressed();
      });

      if (success) {
        this.currentHotkey = hotkey;
        logger.info(`Hotkey registered successfully: ${hotkey}`);
        return true;
      }

      logger.warn(`Failed to register hotkey: ${hotkey}`);
      return false;
    } catch (error) {
      logger.error({ error, hotkey }, 'Error registering hotkey');
      return false;
    }
  }

  /**
   * アイテム検索ホットキーを登録
   * @param hotkey 登録するホットキー
   * @returns 登録成功の可否
   */
  public setItemSearchHotkey(hotkey: string): boolean {
    try {
      this.unregisterHotkeyInternal('itemSearch');

      if (!hotkey || hotkey.trim() === '') {
        logger.info('アイテム検索ホットキーが未設定のため、登録をスキップしました');
        return true;
      }

      if (hotkey === this.currentHotkey) {
        logger.warn(`アイテム検索ホットキーがメインホットキーと競合しています: ${hotkey}`);
        return false;
      }

      const success = globalShortcut.register(hotkey, () => {
        this.handleItemSearchHotkeyPressed();
      });

      if (success) {
        this.currentItemSearchHotkey = hotkey;
        logger.info(`Item search hotkey registered successfully: ${hotkey}`);
        return true;
      }

      logger.warn(`Failed to register item search hotkey: ${hotkey}`);
      return false;
    } catch (error) {
      logger.error({ error, hotkey }, 'Error registering item search hotkey');
      return false;
    }
  }

  /**
   * 現在のホットキーを解除
   */
  public unregisterCurrentHotkey(): void {
    this.unregisterHotkeyInternal('main');
  }

  /**
   * 現在のアイテム検索ホットキーを解除
   */
  public unregisterItemSearchHotkey(): void {
    this.unregisterHotkeyInternal('itemSearch');
  }

  /**
   * 全てのホットキーを解除
   */
  public unregisterAllHotkeys(): void {
    try {
      globalShortcut.unregisterAll();
      this.currentHotkey = null;
      this.currentItemSearchHotkey = null;
      logger.info('All hotkeys unregistered');
    } catch (error) {
      logger.error({ error }, 'Error unregistering all hotkeys');
    }
  }

  /**
   * ホットキーが利用可能かチェック
   * @param hotkey チェックするホットキー
   * @param forItemSearch アイテム検索ホットキー用かどうか
   * @returns 利用可能性
   */
  public isHotkeyAvailable(hotkey: string, forItemSearch: boolean = false): boolean {
    // 現在登録されているホットキーは利用可能とみなす
    const currentHotkey = forItemSearch ? this.currentItemSearchHotkey : this.currentHotkey;
    if (hotkey === currentHotkey) {
      return true;
    }

    // 他方のホットキーとの競合をチェック
    const otherHotkey = forItemSearch ? this.currentHotkey : this.currentItemSearchHotkey;
    if (hotkey === otherHotkey) {
      return false;
    }

    try {
      const tempRegistered = globalShortcut.register(hotkey, () => {});
      if (tempRegistered) {
        globalShortcut.unregister(hotkey);
        return true;
      }
      return false;
    } catch (error) {
      logger.error({ error, hotkey }, 'Error checking hotkey availability');
      return false;
    }
  }

  /**
   * 現在登録されているホットキーを取得
   */
  public getCurrentHotkey(): string | null {
    return this.currentHotkey;
  }

  /**
   * 現在登録されているアイテム検索ホットキーを取得
   */
  public getCurrentItemSearchHotkey(): string | null {
    return this.currentItemSearchHotkey;
  }

  /**
   * ホットキー押下時のハンドラ
   */
  private handleHotkeyPressed(): void {
    try {
      const mainWindow = this.getMainWindow();
      if (!mainWindow) return;

      if (mainWindow.isVisible()) {
        mainWindow.focus();
        void this.hideWindowCallback();
      } else {
        const startTime = Date.now();
        void this.showWindowCallback(startTime);
      }
    } catch (error) {
      logger.error({ error }, 'Error handling hotkey press');
    }
  }

  /**
   * ホットキー変更の共通処理
   */
  private async changeHotkeyInternal(newHotkey: string, type: HotkeyType): Promise<boolean> {
    await this.initializeSettingsService();
    const isItemSearch = type === 'itemSearch';
    const settingKey = isItemSearch ? 'itemSearchHotkey' : 'hotkey';
    const logLabel = isItemSearch ? 'Item search hotkey' : 'Hotkey';

    // 空の場合は無効化（アイテム検索ホットキーのみ許可）
    if (!newHotkey || newHotkey.trim() === '') {
      if (isItemSearch) {
        await this.settingsService.set(settingKey, '');
        this.unregisterHotkeyInternal(type);
        logger.info(`${logLabel} disabled`);
        return true;
      }
      // メインホットキーは空を許可しない
      logger.warn('Main hotkey cannot be empty');
      return false;
    }

    const validation = this.settingsService.validateHotkey(newHotkey);
    if (!validation.isValid) {
      logger.warn(`Invalid ${logLabel.toLowerCase()}: ${newHotkey} - ${validation.reason}`);
      return false;
    }

    if (!this.isHotkeyAvailable(newHotkey, isItemSearch)) {
      logger.warn(`${logLabel} not available: ${newHotkey}`);
      return false;
    }

    await this.settingsService.set(settingKey, newHotkey);

    const success = isItemSearch ? this.setItemSearchHotkey(newHotkey) : this.setHotkey(newHotkey);

    if (success) {
      logger.info(`${logLabel} changed successfully to: ${newHotkey}`);
    }

    return success;
  }

  /**
   * ホットキー変更
   * @param newHotkey 新しいホットキー
   * @returns 変更成功の可否
   */
  public async changeHotkey(newHotkey: string): Promise<boolean> {
    try {
      return await this.changeHotkeyInternal(newHotkey, 'main');
    } catch (error) {
      logger.error({ error, newHotkey }, 'Error changing hotkey');
      return false;
    }
  }

  /**
   * アイテム検索ホットキー変更
   * @param newHotkey 新しいホットキー（空文字列で無効化）
   * @returns 変更成功の可否
   */
  public async changeItemSearchHotkey(newHotkey: string): Promise<boolean> {
    try {
      return await this.changeHotkeyInternal(newHotkey, 'itemSearch');
    } catch (error) {
      logger.error({ error, newHotkey }, 'Error changing item search hotkey');
      return false;
    }
  }

  /**
   * アイテム検索ホットキー押下時のハンドラ
   */
  private handleItemSearchHotkeyPressed(): void {
    try {
      const mainWindow = this.getMainWindow();
      if (!mainWindow || !this.showItemSearchCallback) return;

      const startTime = Date.now();
      void this.showItemSearchCallback(startTime);
    } catch (error) {
      logger.error({ error }, 'Error handling item search hotkey press');
    }
  }
}

export default HotkeyService;
