import { globalShortcut, BrowserWindow } from 'electron';
import logger from '@common/logger';

import { EnvConfig } from '../config/envConfig.js';

import { SettingsService } from './settingsService.js';

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
   * 指定されたホットキーを登録
   * @param hotkey 登録するホットキー
   * @returns 登録成功の可否
   */
  public setHotkey(hotkey: string): boolean {
    try {
      // 現在のホットキーを解除
      this.unregisterCurrentHotkey();

      // ホットキーが空の場合はスキップ（初回起動時など）
      if (!hotkey || hotkey.trim() === '') {
        logger.info('ホットキーが未設定のため、登録をスキップしました');
        return true;
      }

      // 新しいホットキーを登録
      const success = globalShortcut.register(hotkey, () => {
        this.handleHotkeyPressed();
      });

      if (success) {
        this.currentHotkey = hotkey;
        logger.info(`Hotkey registered successfully: ${hotkey}`);
        return true;
      } else {
        logger.warn(`Failed to register hotkey: ${hotkey}`);
        return false;
      }
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
      // 現在のアイテム検索ホットキーを解除
      this.unregisterItemSearchHotkey();

      // ホットキーが空の場合はスキップ
      if (!hotkey || hotkey.trim() === '') {
        logger.info('アイテム検索ホットキーが未設定のため、登録をスキップしました');
        return true;
      }

      // メインホットキーとの競合チェック
      if (hotkey === this.currentHotkey) {
        logger.warn(`アイテム検索ホットキーがメインホットキーと競合しています: ${hotkey}`);
        return false;
      }

      // 新しいホットキーを登録
      const success = globalShortcut.register(hotkey, () => {
        this.handleItemSearchHotkeyPressed();
      });

      if (success) {
        this.currentItemSearchHotkey = hotkey;
        logger.info(`Item search hotkey registered successfully: ${hotkey}`);
        return true;
      } else {
        logger.warn(`Failed to register item search hotkey: ${hotkey}`);
        return false;
      }
    } catch (error) {
      logger.error({ error, hotkey }, 'Error registering item search hotkey');
      return false;
    }
  }

  /**
   * 現在のホットキーを解除
   */
  public unregisterCurrentHotkey(): void {
    if (this.currentHotkey) {
      try {
        globalShortcut.unregister(this.currentHotkey);
        logger.info(`Hotkey unregistered: ${this.currentHotkey}`);
      } catch (error) {
        logger.error({ error, hotkey: this.currentHotkey }, 'Error unregistering hotkey');
      }
      this.currentHotkey = null;
    }
  }

  /**
   * 現在のアイテム検索ホットキーを解除
   */
  public unregisterItemSearchHotkey(): void {
    if (this.currentItemSearchHotkey) {
      try {
        globalShortcut.unregister(this.currentItemSearchHotkey);
        logger.info(`Item search hotkey unregistered: ${this.currentItemSearchHotkey}`);
      } catch (error) {
        logger.error(
          { error, hotkey: this.currentItemSearchHotkey },
          'Error unregistering item search hotkey'
        );
      }
      this.currentItemSearchHotkey = null;
    }
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
    if (!forItemSearch && hotkey === this.currentHotkey) {
      return true;
    }
    if (forItemSearch && hotkey === this.currentItemSearchHotkey) {
      return true;
    }

    // アイテム検索ホットキーの場合、メインホットキーとの競合をチェック
    if (forItemSearch && hotkey === this.currentHotkey) {
      return false;
    }

    // メインホットキーの場合、アイテム検索ホットキーとの競合をチェック
    if (!forItemSearch && hotkey === this.currentItemSearchHotkey) {
      return false;
    }

    try {
      // 一時的に登録してみる
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
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          // まずウィンドウをアクティブ化（他のウィンドウの後ろに隠れている場合でも前面に）
          mainWindow.focus();
          // その後、非表示判定（ピン留めモードなら非表示にならず、アクティブ化のみ）
          // 非同期関数だが、awaitせずに呼び出す（エラーハンドリングのみ実施）
          void this.hideWindowCallback();
        } else {
          // パフォーマンス計測のため、開始時刻を記録（Date.now()を使用してプロセス間で共通のタイムライン）
          const startTime = Date.now();
          // 非同期関数だが、awaitせずに呼び出す（表示処理は並行実行）
          void this.showWindowCallback(startTime);
        }
      }
    } catch (error) {
      logger.error({ error }, 'Error handling hotkey press');
    }
  }

  /**
   * ホットキー変更
   * 設定を更新して新しいホットキーを登録
   * @param newHotkey 新しいホットキー
   * @returns 変更成功の可否
   */
  public async changeHotkey(newHotkey: string): Promise<boolean> {
    try {
      await this.initializeSettingsService();

      // バリデーション
      const validation = this.settingsService.validateHotkey(newHotkey);
      if (!validation.isValid) {
        logger.warn(`Invalid hotkey: ${newHotkey} - ${validation.reason}`);
        return false;
      }

      // 利用可能性チェック
      if (!this.isHotkeyAvailable(newHotkey, false)) {
        logger.warn(`Hotkey not available: ${newHotkey}`);
        return false;
      }

      // 設定を更新
      await this.settingsService.set('hotkey', newHotkey);

      // ホットキーを登録
      const success = this.setHotkey(newHotkey);
      if (success) {
        logger.info(`Hotkey changed successfully to: ${newHotkey}`);
      }

      return success;
    } catch (error) {
      logger.error({ error, newHotkey }, 'Error changing hotkey');
      return false;
    }
  }

  /**
   * アイテム検索ホットキー変更
   * 設定を更新して新しいホットキーを登録
   * @param newHotkey 新しいホットキー（空文字列で無効化）
   * @returns 変更成功の可否
   */
  public async changeItemSearchHotkey(newHotkey: string): Promise<boolean> {
    try {
      await this.initializeSettingsService();

      // 空の場合は無効化
      if (!newHotkey || newHotkey.trim() === '') {
        // 設定を更新（空文字）
        await this.settingsService.set('itemSearchHotkey', '');
        // ホットキーを解除
        this.unregisterItemSearchHotkey();
        logger.info('Item search hotkey disabled');
        return true;
      }

      // バリデーション
      const validation = this.settingsService.validateHotkey(newHotkey);
      if (!validation.isValid) {
        logger.warn(`Invalid item search hotkey: ${newHotkey} - ${validation.reason}`);
        return false;
      }

      // 利用可能性チェック（アイテム検索ホットキー用）
      if (!this.isHotkeyAvailable(newHotkey, true)) {
        logger.warn(`Item search hotkey not available: ${newHotkey}`);
        return false;
      }

      // 設定を更新
      await this.settingsService.set('itemSearchHotkey', newHotkey);

      // ホットキーを登録
      const success = this.setItemSearchHotkey(newHotkey);
      if (success) {
        logger.info(`Item search hotkey changed successfully to: ${newHotkey}`);
      }

      return success;
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
      if (mainWindow && this.showItemSearchCallback) {
        // パフォーマンス計測のため、開始時刻を記録
        const startTime = Date.now();
        // 非同期関数だが、awaitせずに呼び出す（表示処理は並行実行）
        void this.showItemSearchCallback(startTime);
      }
    } catch (error) {
      logger.error({ error }, 'Error handling item search hotkey press');
    }
  }
}

export default HotkeyService;
