import ElectronStore from 'electron-store';

import type { AppSettings } from '../../common/types.js';
import logger from '../../common/logger.js';
import PathManager from '../config/pathManager.js';

// electron-storeを動的にインポート
let Store: typeof ElectronStore | null = null;

/**
 * アプリケーション設定を管理するサービスクラス
 * electron-storeを使用して設定の永続化を行う
 */
export class SettingsService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private store: any | null = null;
  private static instance: SettingsService;

  /**
   * デフォルト設定値
   */
  private static readonly DEFAULT_SETTINGS: AppSettings = {
    hotkey: '', // 初回起動時は空、初回設定画面で設定される
    windowWidth: 600,
    windowHeight: 400,
    editModeWidth: 1200,
    editModeHeight: 700,
    autoLaunch: false,
    backupEnabled: false,
    backupOnStart: false,
    backupOnEdit: false,
    backupInterval: 5,
    backupRetention: 20,
    showDataFileTabs: false, // タブ表示OFF（デフォルト）
    defaultFileTab: 'data.txt', // デフォルトタブ
    dataFileTabNames: {}, // タブ名のカスタマイズ（空=ファイル名をそのまま表示）
    tabOrder: [], // タブ順序（空=ファイル名順）
  };

  private constructor() {
    // electron-storeは後で非同期に初期化
    this.store = null;
  }

  /**
   * electron-storeを非同期で初期化
   */
  private async initializeStore(): Promise<void> {
    if (this.store) return; // 既に初期化済み

    try {
      if (!Store) {
        // electron-storeを動的にインポート
        const module = await import('electron-store');
        Store = module.default;
      }

      // PathManagerから設定フォルダを取得
      const configFolder = PathManager.getConfigFolder();

      this.store = new Store!<AppSettings>({
        name: 'settings',
        cwd: configFolder, // カスタムパスを指定
        defaults: SettingsService.DEFAULT_SETTINGS,
      });

      logger.info(`SettingsService initialized successfully at ${configFolder}`);
    } catch (error) {
      logger.error('Failed to initialize SettingsService:', error);
      throw error;
    }
  }

  /**
   * SettingsServiceのシングルトンインスタンスを取得
   */
  public static async getInstance(): Promise<SettingsService> {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
      await SettingsService.instance.initializeStore();
    }
    return SettingsService.instance;
  }

  /**
   * 設定値を取得
   * @param key 設定キー
   * @returns 設定値
   */
  public async get<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');
    try {
      return this.store.get(key) as AppSettings[K];
    } catch (error) {
      logger.error(`Failed to get setting ${key}:`, error);
      return SettingsService.DEFAULT_SETTINGS[key];
    }
  }

  /**
   * 設定値を設定
   * @param key 設定キー
   * @param value 設定値
   */
  public async set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');
    try {
      this.store.set(key as string, value);
      logger.info(`Setting ${key} updated to:`, value);
    } catch (error) {
      logger.error(`Failed to set setting ${key}:`, error);
      throw error;
    }
  }

  /**
   * 複数の設定値を一括設定
   * @param settings 設定オブジェクト
   */
  public async setMultiple(settings: Partial<AppSettings>): Promise<void> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');
    try {
      Object.entries(settings).forEach(([key, value]) => {
        if (value !== undefined) {
          this.store!.set(key as string, value);
        }
      });
      logger.info('Multiple settings updated:', settings);
    } catch (error) {
      logger.error('Failed to set multiple settings:', error);
      throw error;
    }
  }

  /**
   * 全設定を取得
   * @returns 全設定オブジェクト
   */
  public async getAll(): Promise<AppSettings> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');
    try {
      return this.store.store as AppSettings;
    } catch (error) {
      logger.error('Failed to get all settings:', error);
      return SettingsService.DEFAULT_SETTINGS;
    }
  }

  /**
   * 設定をデフォルト値にリセット
   */
  public async reset(): Promise<void> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');
    try {
      this.store.clear();
      logger.info('Settings reset to defaults');
    } catch (error) {
      logger.error('Failed to reset settings:', error);
      throw error;
    }
  }

  /**
   * ホットキーの妥当性を検証
   * @param hotkey 検証するホットキー文字列
   * @returns 妥当性の結果
   */
  public validateHotkey(hotkey: string): { isValid: boolean; reason?: string } {
    if (!hotkey || typeof hotkey !== 'string') {
      return { isValid: false, reason: 'ホットキーが指定されていません' };
    }

    // 基本的なパターンチェック
    const pattern =
      /^(Ctrl|Alt|Shift|CmdOrCtrl|Command|Cmd)\+(Ctrl|Alt|Shift|CmdOrCtrl|Command|Cmd|[A-Z0-9]|Space|Enter|Tab|Escape|Delete|Backspace|F[1-9]|F1[0-2])+(\+([A-Z0-9]|Space|Enter|Tab|Escape|Delete|Backspace|F[1-9]|F1[0-2]))*$/;
    if (!pattern.test(hotkey)) {
      return { isValid: false, reason: 'ホットキーの形式が正しくありません' };
    }

    // 修飾キーが最低1つ含まれているかチェック
    const modifiers = ['Ctrl', 'Alt', 'Shift', 'CmdOrCtrl', 'Command', 'Cmd'];
    const hasModifier = modifiers.some((modifier) => hotkey.includes(modifier));
    if (!hasModifier) {
      return { isValid: false, reason: '修飾キー（Ctrl、Alt、Shift等）が必要です' };
    }

    return { isValid: true };
  }

  /**
   * 設定ファイルのパスを取得
   * @returns 設定ファイルのフルパス
   */
  public async getConfigPath(): Promise<string> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');
    return this.store.path as string;
  }
}

// デフォルトエクスポート
export default SettingsService;
