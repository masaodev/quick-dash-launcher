import fs from 'node:fs';
import path from 'node:path';

import ElectronStore from 'electron-store';
import type { AppSettings } from '@common/types.js';
import logger from '@common/logger.js';

import PathManager from '../config/pathManager.js';

// electron-storeを動的にインポート
let Store: typeof ElectronStore | null = null;

/**
 * electron-storeのインスタンス型
 * 動的インポートの型定義問題を解決するための型定義
 */
type StoreInstance = {
  get<K extends keyof AppSettings>(key: K): AppSettings[K];
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
  store: AppSettings;
  clear(): void;
  path: string;
};

/**
 * アプリケーション設定を管理するサービスクラス
 * electron-storeを使用して設定の永続化を行う
 */
export class SettingsService {
  /**
   * electron-storeのインスタンス
   */
  private store: StoreInstance | null = null;
  private static instance: SettingsService;

  /**
   * デフォルト設定値
   */
  private static readonly DEFAULT_SETTINGS: AppSettings = {
    hotkey: '', // 初回起動時は空、初回設定画面で設定される
    windowWidth: 600,
    windowHeight: 400,
    editModeWidth: 1200,
    editModeHeight: 1000,
    autoLaunch: false,
    backupEnabled: false,
    backupOnStart: false,
    backupOnEdit: false,
    backupInterval: 5,
    backupRetention: 20,
    showDataFileTabs: false, // タブ表示OFF（デフォルト）
    defaultFileTab: 'data.txt', // デフォルトタブ
    dataFileTabs: [{ files: ['data.txt'], name: 'メイン' }], // データファイルタブの設定
    dataFileLabels: { 'data.txt': 'メイン用データファイル' }, // データファイルのラベル定義
    windowPositionMode: 'center', // ウィンドウ表示位置モード（デフォルト: 画面中央）
    windowPositionX: 0, // 固定位置のX座標
    windowPositionY: 0, // 固定位置のY座標
    workspaceOpacity: 100, // ワークスペースウィンドウの不透明度（デフォルト: 100%）
    workspaceBackgroundTransparent: false, // ワークスペースウィンドウの背景のみを透過（デフォルト: false）
    autoShowWorkspace: false, // メイン画面表示時にワークスペースを自動表示（デフォルト: false）
    workspacePositionMode: 'primaryRight', // ワークスペース表示位置モード（デフォルト: 右端）
    workspacePositionX: 0, // ワークスペース固定位置のX座標
    workspacePositionY: 0, // ワークスペース固定位置のY座標
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

      // 設定ファイルが既に存在するかチェック（新規作成判定用）
      const settingsFilePath = path.join(configFolder, 'settings.json');
      const isNewFile = !fs.existsSync(settingsFilePath);

      this.store = new Store!<AppSettings>({
        name: 'settings',
        cwd: configFolder, // カスタムパスを指定
        defaults: SettingsService.DEFAULT_SETTINGS,
      }) as unknown as StoreInstance;

      // 新規作成時のみバージョンを記録
      if (isNewFile) {
        await this.setCreatedWithVersion();
      }

      logger.info(`SettingsService initialized successfully at ${configFolder}`);
    } catch (error) {
      logger.error({ error }, 'Failed to initialize SettingsService');
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
      return this.store.get(key);
    } catch (error) {
      logger.error({ error, key }, 'Failed to get setting');
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
      this.store.set(key, value);
      await this.updateVersionIfNeeded(key);
      logger.info({ key, value }, 'Setting updated');
    } catch (error) {
      logger.error({ error, key }, 'Failed to set setting');
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
      // バージョン情報以外のキーがあるかチェック
      const hasNonVersionKey = Object.keys(settings).some(
        (key) => key !== 'createdWithVersion' && key !== 'updatedWithVersion'
      );

      Object.entries(settings).forEach(([key, value]) => {
        if (value !== undefined && this.store) {
          this.store.set(key as keyof AppSettings, value);
        }
      });

      // バージョン情報以外の更新があった場合のみ更新バージョンを記録
      if (hasNonVersionKey) {
        const version = await this.getAppVersion();
        const currentVersion = this.store.get('updatedWithVersion');
        if (currentVersion !== version) {
          this.store.set('updatedWithVersion', version);
          logger.info({ version }, 'Settings file updated with version');
        }
      }

      logger.info({ settings }, 'Multiple settings updated');
    } catch (error) {
      logger.error({ error }, 'Failed to set multiple settings');
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
      return this.store.store;
    } catch (error) {
      logger.error({ error }, 'Failed to get all settings');
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
      logger.error({ error }, 'Failed to reset settings');
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
   * 現在のアプリバージョンを取得
   */
  private async getAppVersion(): Promise<string> {
    try {
      const packageJson = await import('../../../package.json');
      return packageJson.version || '0.0.0';
    } catch (error) {
      logger.error({ error }, 'Failed to get app version');
      return '0.0.0';
    }
  }

  /**
   * 設定ファイルに作成時のアプリバージョンを記録
   * 新規作成時のみ呼び出される
   */
  private async setCreatedWithVersion(): Promise<void> {
    if (!this.store) return;

    try {
      const version = await this.getAppVersion();
      this.store.set('createdWithVersion', version);
      this.store.set('updatedWithVersion', version);
      logger.info({ version }, 'Settings file created with version');
    } catch (error) {
      logger.error({ error }, 'Failed to set createdWithVersion');
    }
  }

  /**
   * 設定ファイルの更新バージョンを記録
   */
  private async updateVersionIfNeeded(key: keyof AppSettings): Promise<void> {
    // バージョン情報フィールド自体の更新時は記録しない（無限ループ防止）
    if (key === 'createdWithVersion' || key === 'updatedWithVersion') {
      return;
    }
    if (!this.store) return;

    try {
      const version = await this.getAppVersion();
      const currentVersion = this.store.get('updatedWithVersion');
      if (currentVersion !== version) {
        this.store.set('updatedWithVersion', version);
        logger.info(`Settings file updated with version: ${version}`);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to update updatedWithVersion');
    }
  }

  /**
   * 設定ファイルのパスを取得
   * @returns 設定ファイルのフルパス
   */
  public async getConfigPath(): Promise<string> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');
    return this.store.path;
  }
}

// デフォルトエクスポート
export default SettingsService;
