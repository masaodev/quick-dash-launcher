import { globalShortcut, BrowserWindow } from 'electron';

import logger from '../../common/logger.js';
import { showMainWindow, hideMainWindow } from '../windowManager.js';

import { SettingsService } from './settingsService.js';

/**
 * ホットキー管理サービス
 * 動的なホットキーの登録・解除・変更を管理
 */
export class HotkeyService {
  private static instance: HotkeyService;
  private settingsService!: SettingsService;
  private currentHotkey: string | null = null;
  private getMainWindow: () => BrowserWindow | null;

  private constructor(getMainWindow: () => BrowserWindow | null) {
    this.getMainWindow = getMainWindow;
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
  public static getInstance(getMainWindow?: () => BrowserWindow | null): HotkeyService {
    if (!HotkeyService.instance) {
      if (!getMainWindow) {
        throw new Error('HotkeyService requires getMainWindow function on first initialization');
      }
      HotkeyService.instance = new HotkeyService(getMainWindow);
    }
    return HotkeyService.instance;
  }

  /**
   * 設定からホットキーを読み込んで登録
   */
  public async registerHotkey(): Promise<boolean> {
    try {
      await this.initializeSettingsService();
      const hotkey = await this.settingsService.get('hotkey');
      return this.setHotkey(hotkey);
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
   * 全てのホットキーを解除
   */
  public unregisterAllHotkeys(): void {
    try {
      globalShortcut.unregisterAll();
      this.currentHotkey = null;
      logger.info('All hotkeys unregistered');
    } catch (error) {
      logger.error({ error }, 'Error unregistering all hotkeys');
    }
  }

  /**
   * ホットキーが利用可能かチェック
   * @param hotkey チェックするホットキー
   * @returns 利用可能性
   */
  public isHotkeyAvailable(hotkey: string): boolean {
    if (hotkey === this.currentHotkey) {
      return true; // 現在登録されているホットキーは利用可能とみなす
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
   * ホットキー押下時のハンドラ
   */
  private handleHotkeyPressed(): void {
    try {
      const mainWindow = this.getMainWindow();
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          hideMainWindow();
        } else {
          // パフォーマンス計測のため、開始時刻を記録（Date.now()を使用してプロセス間で共通のタイムライン）
          const startTime = Date.now();
          // 非同期関数だが、awaitせずに呼び出す（表示処理は並行実行）
          void showMainWindow(startTime);
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
      if (!this.isHotkeyAvailable(newHotkey)) {
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
}

export default HotkeyService;
