import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_DATA_FILE, DEFAULT_BOOKMARK_AUTO_IMPORT_SETTINGS } from '@common/types';
import type { AppSettings } from '@common/types';
import logger from '@common/logger';

import PathManager from '../config/pathManager.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Store: any = null;

/** electron-storeのインスタンス型 */
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
  private store: StoreInstance | null = null;
  private static instance: SettingsService;

  private static readonly DEFAULT_SETTINGS: AppSettings = {
    hotkey: '',
    windowWidth: 600,
    windowHeight: 400,
    editModeWidth: 1200,
    editModeHeight: 1000,
    autoLaunch: false,
    backupEnabled: false,
    backupRetention: 10,
    showDataFileTabs: false,
    defaultFileTab: DEFAULT_DATA_FILE,
    dataFileTabs: [{ files: [DEFAULT_DATA_FILE], name: 'メイン' }],
    dataFileLabels: { [DEFAULT_DATA_FILE]: 'メイン用データファイル' },
    windowPositionMode: 'cursorMonitorCenter',
    windowPositionX: 0,
    windowPositionY: 0,
    workspaceOpacity: 100,
    workspaceBackgroundTransparent: false,
    autoShowWorkspace: false,
    workspacePositionMode: 'displayRight',
    workspaceTargetDisplayIndex: 0,
    workspacePositionX: 0,
    workspacePositionY: 0,
    workspaceVisibleOnAllDesktops: true,
    backupIncludeClipboard: false,
    parallelGroupLaunch: false,
    itemSearchHotkey: '',
    bookmarkAutoImport: DEFAULT_BOOKMARK_AUTO_IMPORT_SETTINGS,
    hideDetachedWithMainWindow: true,
    windowSnapEnabled: true,
  };

  private constructor() {}

  private async initializeStore(): Promise<void> {
    if (this.store) return;

    if (!Store) {
      const module = await import('electron-store');
      Store = module.default;
    }

    const configFolder = PathManager.getConfigFolder();
    const settingsFilePath = path.join(configFolder, 'settings.json');
    const isNewFile = !fs.existsSync(settingsFilePath);

    this.store = new Store({
      name: 'settings',
      cwd: configFolder,
      defaults: SettingsService.DEFAULT_SETTINGS,
    }) as StoreInstance;

    if (isNewFile) {
      await this.setCreatedWithVersion();
    }

    logger.info(`SettingsService initialized successfully at ${configFolder}`);
  }

  /** ストアが初期化されていることを保証し、インスタンスを返す */
  private async ensureStore(): Promise<StoreInstance> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');
    return this.store;
  }

  public static async getInstance(): Promise<SettingsService> {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
      await SettingsService.instance.initializeStore();
    }
    return SettingsService.instance;
  }

  public async get<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
    const store = await this.ensureStore();
    try {
      return store.get(key);
    } catch (error) {
      logger.error({ error, key }, 'Failed to get setting');
      return SettingsService.DEFAULT_SETTINGS[key];
    }
  }

  public async set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    const store = await this.ensureStore();
    store.set(key, value);
    if (key !== 'createdWithVersion' && key !== 'updatedWithVersion') {
      await this.recordUpdatedVersion(store);
    }
    logger.info({ key, value }, 'Setting updated');
  }

  public async setMultiple(settings: Partial<AppSettings>): Promise<void> {
    const store = await this.ensureStore();
    const hasNonVersionKey = Object.keys(settings).some(
      (key) => key !== 'createdWithVersion' && key !== 'updatedWithVersion'
    );

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        store.set(key as keyof AppSettings, value);
      }
    }

    if (hasNonVersionKey) {
      await this.recordUpdatedVersion(store);
    }

    logger.info({ settings }, 'Multiple settings updated');
  }

  public async getAll(): Promise<AppSettings> {
    const store = await this.ensureStore();
    try {
      return store.store;
    } catch (error) {
      logger.error({ error }, 'Failed to get all settings');
      return SettingsService.DEFAULT_SETTINGS;
    }
  }

  public async reset(): Promise<void> {
    const store = await this.ensureStore();
    store.clear();
    logger.info('Settings reset to defaults');
  }

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

  public async getConfigPath(): Promise<string> {
    const store = await this.ensureStore();
    return store.path;
  }

  private async getAppVersion(): Promise<string> {
    try {
      const packageJson = await import('../../../package.json');
      return packageJson.version || '0.0.0';
    } catch (error) {
      logger.error({ error }, 'Failed to get app version');
      return '0.0.0';
    }
  }

  private async setCreatedWithVersion(): Promise<void> {
    if (!this.store) return;
    const version = await this.getAppVersion();
    this.store.set('createdWithVersion', version);
    this.store.set('updatedWithVersion', version);
    logger.info({ version }, 'Settings file created with version');
  }

  private async recordUpdatedVersion(store: StoreInstance): Promise<void> {
    const version = await this.getAppVersion();
    if (store.get('updatedWithVersion') !== version) {
      store.set('updatedWithVersion', version);
      logger.info({ version }, 'Settings file updated with version');
    }
  }
}

// デフォルトエクスポート
export default SettingsService;
