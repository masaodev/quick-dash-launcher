import { globalShortcut, BrowserWindow } from 'electron';
import logger from '@common/logger';

import { EnvConfig } from '../config/envConfig.js';
import { getHwnd, moveWindowToCurrentDesktop } from '../utils/virtualDesktop/index.js';

import { SettingsService } from './settingsService.js';

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
  private readonly getMainWindow: () => BrowserWindow | null;
  private readonly showWindowCallback: (startTime?: number) => Promise<void>;
  private readonly hideWindowCallback: () => Promise<void>;
  private showItemSearchCallback: ((startTime?: number) => Promise<void>) | null = null;
  /** suspendHotkeys で外したホットキー（外していないときは null） */
  private suspendedHotkeys: Record<HotkeyType, string | null> | null = null;

  private constructor(
    getMainWindow: () => BrowserWindow | null,
    showWindowCallback: (startTime?: number) => Promise<void>,
    hideWindowCallback: () => Promise<void>
  ) {
    this.getMainWindow = getMainWindow;
    this.showWindowCallback = showWindowCallback;
    this.hideWindowCallback = hideWindowCallback;
  }

  public setItemSearchCallback(callback: (startTime?: number) => Promise<void>): void {
    this.showItemSearchCallback = callback;
  }

  private async initializeSettingsService(): Promise<void> {
    if (!this.settingsService) {
      this.settingsService = await SettingsService.getInstance();
    }
  }

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

      const envHotkey = EnvConfig.customHotkey;
      const hotkey = envHotkey || (await this.settingsService.get('hotkey'));

      if (envHotkey) {
        logger.info(`Using hotkey from environment variable: ${envHotkey}`);
      }

      const mainSuccess = this.registerHotkeyInternal(hotkey, 'main');

      // ランチャーのホットキーが未設定（初回設定の画面を出している間）は、ウィンドウ検索のホットキーも
      // 登録しない。ウィンドウ検索には既定値があるので、登録すると初回設定の途中で開いてしまう。
      // 初回設定の完了時に登録する
      if (!hotkey?.trim()) {
        logger.info('初回設定が終わっていないため、ウィンドウ検索のホットキーの登録を見送りました');
        return mainSuccess;
      }

      const itemSearchHotkey = await this.settingsService.get('itemSearchHotkey');
      const itemSearchSuccess = this.registerHotkeyInternal(itemSearchHotkey, 'itemSearch');

      return mainSuccess && itemSearchSuccess;
    } catch (error) {
      logger.error({ error }, 'Failed to register hotkey from settings');
      return false;
    }
  }

  private unregisterHotkeyInternal(type: HotkeyType): void {
    const isMain = type === 'main';
    const hotkey = isMain ? this.currentHotkey : this.currentItemSearchHotkey;
    if (!hotkey) return;

    try {
      globalShortcut.unregister(hotkey);
      logger.info(`${isMain ? 'Hotkey' : 'Item search hotkey'} unregistered: ${hotkey}`);
    } catch (error) {
      logger.error({ error, hotkey }, `Error unregistering ${type} hotkey`);
    }

    if (isMain) {
      this.currentHotkey = null;
    } else {
      this.currentItemSearchHotkey = null;
    }
  }

  private registerHotkeyInternal(hotkey: string, type: HotkeyType): boolean {
    const isMain = type === 'main';
    const label = isMain ? 'Hotkey' : 'Item search hotkey';

    // 外している間に設定から登録し直されたら、そちらを優先する（resumeHotkeys で元に戻さない）
    if (this.suspendedHotkeys) {
      this.suspendedHotkeys[type] = null;
    }

    try {
      this.unregisterHotkeyInternal(type);

      if (!hotkey?.trim()) {
        logger.info(`${label}が未設定のため、登録をスキップしました`);
        return true;
      }

      if (!isMain && hotkey === this.currentHotkey) {
        logger.warn(
          `ウィンドウ検索の起動ホットキーがランチャー起動ホットキーと競合しています: ${hotkey}`
        );
        return false;
      }

      const handler = isMain
        ? () => this.handleHotkeyPressed()
        : () => this.handleItemSearchHotkeyPressed();

      const success = globalShortcut.register(hotkey, handler);

      if (success) {
        if (isMain) {
          this.currentHotkey = hotkey;
        } else {
          this.currentItemSearchHotkey = hotkey;
        }
        logger.info(`${label} registered successfully: ${hotkey}`);
        return true;
      }

      logger.warn(`Failed to register ${label.toLowerCase()}: ${hotkey}`);
      return false;
    } catch (error) {
      logger.error({ error, hotkey }, `Error registering ${label.toLowerCase()}`);
      return false;
    }
  }

  public setHotkey(hotkey: string): boolean {
    return this.registerHotkeyInternal(hotkey, 'main');
  }

  public setItemSearchHotkey(hotkey: string): boolean {
    return this.registerHotkeyInternal(hotkey, 'itemSearch');
  }

  public unregisterCurrentHotkey(): void {
    this.unregisterHotkeyInternal('main');
  }

  public unregisterItemSearchHotkey(): void {
    this.unregisterHotkeyInternal('itemSearch');
  }

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
   * 登録中のホットキーを一時的に外す
   * ホットキー入力欄の録画中に今のホットキーを押しても、ランチャーが開かずに入力欄へ届くようにする
   */
  public suspendHotkeys(): void {
    if (this.suspendedHotkeys) return;
    this.suspendedHotkeys = { main: this.currentHotkey, itemSearch: this.currentItemSearchHotkey };
    this.unregisterHotkeyInternal('main');
    this.unregisterHotkeyInternal('itemSearch');
    logger.info('ホットキーの録画中のため、ホットキーを一時的に外しました');
  }

  /** suspendHotkeys で外したホットキーを登録し直す */
  public resumeHotkeys(): void {
    const suspended = this.suspendedHotkeys;
    if (!suspended) return;
    this.suspendedHotkeys = null;
    if (suspended.main) this.registerHotkeyInternal(suspended.main, 'main');
    if (suspended.itemSearch) this.registerHotkeyInternal(suspended.itemSearch, 'itemSearch');
    logger.info('ホットキーの録画が終わったため、ホットキーを登録し直しました');
  }

  public isHotkeyAvailable(hotkey: string, forItemSearch: boolean = false): boolean {
    const currentHotkey = forItemSearch ? this.currentItemSearchHotkey : this.currentHotkey;
    if (hotkey === currentHotkey) return true;

    const otherHotkey = forItemSearch ? this.currentHotkey : this.currentItemSearchHotkey;
    if (hotkey === otherHotkey) return false;

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

  public getCurrentHotkey(): string | null {
    return this.currentHotkey;
  }

  public getCurrentItemSearchHotkey(): string | null {
    return this.currentItemSearchHotkey;
  }

  private handleHotkeyPressed(): void {
    try {
      const mainWindow = this.getMainWindow();
      if (!mainWindow) return;

      if (mainWindow.isVisible()) {
        // 表示したまま別の仮想デスクトップにある（ピン留め中など）ときは、隠さずに今のデスクトップへ呼び寄せる。
        // 先に focus() すると、Windows がランチャーのあるデスクトップへ切り替えてしまう
        if (moveWindowToCurrentDesktop(getHwnd(mainWindow))) {
          void this.showWindowCallback(Date.now());
          return;
        }
        mainWindow.focus();
        void this.hideWindowCallback();
      } else {
        void this.showWindowCallback(Date.now());
      }
    } catch (error) {
      logger.error({ error }, 'Error handling hotkey press');
    }
  }

  private handleItemSearchHotkeyPressed(): void {
    try {
      const mainWindow = this.getMainWindow();
      if (!mainWindow || !this.showItemSearchCallback) return;

      void this.showItemSearchCallback(Date.now());
    } catch (error) {
      logger.error({ error }, 'Error handling item search hotkey press');
    }
  }

  private async changeHotkeyInternal(newHotkey: string, type: HotkeyType): Promise<boolean> {
    await this.initializeSettingsService();
    const isItemSearch = type === 'itemSearch';
    const settingKey = isItemSearch ? 'itemSearchHotkey' : 'hotkey';
    const logLabel = isItemSearch ? 'Item search hotkey' : 'Hotkey';

    if (!newHotkey?.trim()) {
      if (isItemSearch) {
        await this.settingsService.set(settingKey, '');
        this.unregisterHotkeyInternal(type);
        logger.info(`${logLabel} disabled`);
        return true;
      }
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

    const success = this.registerHotkeyInternal(newHotkey, type);
    if (success) {
      logger.info(`${logLabel} changed successfully to: ${newHotkey}`);
    }

    return success;
  }

  public async changeHotkey(newHotkey: string): Promise<boolean> {
    try {
      return await this.changeHotkeyInternal(newHotkey, 'main');
    } catch (error) {
      logger.error({ error, newHotkey }, 'Error changing hotkey');
      return false;
    }
  }

  public async changeItemSearchHotkey(newHotkey: string): Promise<boolean> {
    try {
      return await this.changeHotkeyInternal(newHotkey, 'itemSearch');
    } catch (error) {
      logger.error({ error, newHotkey }, 'Error changing item search hotkey');
      return false;
    }
  }
}

export default HotkeyService;
