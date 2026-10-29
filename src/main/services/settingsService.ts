import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';
import { DEFAULT_DATA_FILE, DEFAULT_BOOKMARK_AUTO_IMPORT_SETTINGS } from '@common/types';
import type { AppSettings } from '@common/types';
import { validateHotkey } from '@common/utils/hotkeyValidator';
import { DEFAULT_LANGUAGE_SETTING } from '@common/i18n/languages';
import logger from '@common/logger';

import PathManager from '../config/pathManager.js';

import { brokenFilePath } from './jsonFileStore.js';
import { mainI18n } from './mainI18n.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Store: any = null;

/** electron-storeのインスタンス型 */
type StoreInstance = {
  get<K extends keyof AppSettings>(key: K): AppSettings[K];
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
  store: AppSettings;
  clear(): void;
  delete(key: string): void;
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
    language: DEFAULT_LANGUAGE_SETTING,
    hotkey: '',
    windowWidth: 600,
    windowHeight: 400,
    editModeWidth: 1200,
    editModeHeight: 1000,
    // 既定で有効（初回設定画面のチェックの既定と合わせる）。2026-10 に false から変更。
    // 設定ファイルには初回起動時に既定値が書き込まれるので、それより前から使っている人の設定は変わらない
    autoLaunch: true,
    cliEnabled: false,
    // 既定で有効（起動時に 1 日 1 回・変更があるときだけ・保持件数で頭打ち）。2026-10 に false から変更。
    // 設定ファイルには初回起動時に既定値が書き込まれるので、それより前から使っている人の設定は変わらない
    backupEnabled: true,
    backupRetention: 10,
    showDataFileTabs: true,
    defaultFileTab: DEFAULT_DATA_FILE,
    dataFileTabs: [{ files: [DEFAULT_DATA_FILE], name: 'メイン' }],
    dataFileLabels: { [DEFAULT_DATA_FILE]: 'メイン用データファイル' },
    windowPositionMode: 'cursorMonitorCenter',
    windowFixedPosition: null,
    workspaceOpacity: 100,
    workspaceBackgroundTransparent: false,
    workspacePositionMode: 'displayRight',
    workspaceTargetDisplayIndex: -1,
    workspaceFixedPosition: null,
    workspaceVisibleOnAllDesktops: true,
    detachedVisibleOnAllDesktops: true,
    backupIncludeClipboard: false,
    showKeyboardHints: true,
    searchMemo: false,
    searchIgnoreWidth: false,
    searchIgnoreKana: false,
    itemSearchHotkey: 'Ctrl+Alt+Space',
    bookmarkAutoImport: DEFAULT_BOOKMARK_AUTO_IMPORT_SETTINGS,
    detachedPositionMode: 'mainDisplay',
    windowSnapEnabled: true,
    recordLaunchUsage: true,
    adminItemColumns: { visible: {}, widths: {} },
  };

  private constructor() {}

  /** 設定値ではないメタ情報のキー（更新しても updatedWithVersion を進めない） */
  private static isMetadataKey(key: keyof AppSettings): boolean {
    return key === 'createdWithVersion' || key === 'updatedWithVersion';
  }

  /** 既定値の写し（設定画面で「既定値のままか」と戻すと何が変わるかを示すため） */
  public static getDefaults(): AppSettings {
    return structuredClone(SettingsService.DEFAULT_SETTINGS);
  }

  private async initializeStore(): Promise<void> {
    if (this.store) return;

    if (!Store) {
      const module = await import('electron-store');
      Store = module.default;
    }

    const configFolder = PathManager.getConfigFolder();
    const settingsFilePath = path.join(configFolder, 'settings.json');
    let isNewFile = !fs.existsSync(settingsFilePath);

    const storeOptions = {
      name: 'settings',
      cwd: configFolder,
      defaults: SettingsService.DEFAULT_SETTINGS,
      // 手で直して BOM 付きで保存しても読めるよう、先頭の BOM を外してから読む
      deserialize: (text: string) =>
        JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text),
    };
    try {
      this.store = new Store(storeOptions) as StoreInstance;
    } catch (error) {
      // 手で直して JSON を壊すと electron-store が例外を投げ、起動がそこで止まる（画面もトレイも出ない）。
      // 壊れたファイルを別名で退避して、既定値で起動する（元に戻す手がかりを残す）
      if (!(error instanceof SyntaxError) || !fs.existsSync(settingsFilePath)) throw error;
      const dest = brokenFilePath(settingsFilePath);
      fs.renameSync(settingsFilePath, dest);
      logger.warn(
        { error, brokenFile: dest },
        'settings.json を読めないため別名で退避し、既定値で起動します'
      );
      this.store = new Store(storeOptions) as StoreInstance;
      isNewFile = true;
    }

    if (isNewFile) {
      this.setCreatedWithVersion();
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
    if (!SettingsService.isMetadataKey(key)) {
      this.recordUpdatedVersion(store);
    }
    logger.info({ key, value }, 'Setting updated');
  }

  /**
   * 設定から外した古いキーの値を読む（ファイルに残っているものだけ）。読み替えた後に deleteRemovedKeys で消す
   */
  public async readRemovedKeys(keys: readonly string[]): Promise<Record<string, unknown>> {
    const store = await this.ensureStore();
    const raw = store.store as unknown as Record<string, unknown>;
    const found: Record<string, unknown> = {};
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) found[key] = raw[key];
    }
    return found;
  }

  /** 設定から外した古いキーを消す */
  public async deleteRemovedKeys(keys: readonly string[]): Promise<void> {
    const store = await this.ensureStore();
    for (const key of keys) store.delete(key);
  }

  public async setMultiple(settings: Partial<AppSettings>): Promise<void> {
    const store = await this.ensureStore();
    const hasNonMetadataKey = Object.keys(settings).some(
      (key) => !SettingsService.isMetadataKey(key as keyof AppSettings)
    );

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        store.set(key as keyof AppSettings, value);
      }
    }

    if (hasNonMetadataKey) {
      this.recordUpdatedVersion(store);
    }

    logger.info({ settings }, 'Multiple settings updated');
  }

  /**
   * 旧設定「グループアイテムを並列起動」の値（グループをセットに変換するときの開き方に写す）
   *
   * 設定の項目からは消したので、保存されている値をそのまま読む
   */
  public async getLegacyParallelGroupLaunch(): Promise<boolean> {
    const store = await this.ensureStore();
    try {
      return (store.store as unknown as Record<string, unknown>).parallelGroupLaunch === true;
    } catch {
      return false;
    }
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

  /** 指定した項目だけ既定値に戻す（他の項目・メタ情報は残す） */
  public async resetKeys(keys: ReadonlyArray<keyof AppSettings>): Promise<void> {
    const defaults: Partial<AppSettings> = {};
    for (const key of keys) {
      if (SettingsService.isMetadataKey(key)) continue;
      const value = SettingsService.DEFAULT_SETTINGS[key];
      if (value !== undefined) {
        // 既定値はオブジェクトを含むので、ストアと共有しないようコピーする
        (defaults as Record<string, unknown>)[key] = structuredClone(value);
      }
    }
    await this.setMultiple(defaults);
    logger.info({ keys }, 'Settings reset to defaults (partial)');
  }

  /**
   * 判定は src/common/utils/hotkeyValidator.ts（修飾キー 1 つ以上 + 通常キーちょうど 1 つ）。
   * 弾いた理由は今の表示言語の文言にして返す
   */
  public validateHotkey(hotkey: string): { isValid: boolean; reason?: string } {
    const result = validateHotkey(hotkey);
    if (result.isValid || !result.reason) return { isValid: result.isValid };
    return { isValid: false, reason: mainI18n.t(`hotkey.invalid.${result.reason}`) };
  }

  private setCreatedWithVersion(): void {
    if (!this.store) return;
    const version = app.getVersion();
    this.store.set('createdWithVersion', version);
    this.store.set('updatedWithVersion', version);
    logger.info({ version }, 'Settings file created with version');
  }

  private recordUpdatedVersion(store: StoreInstance): void {
    const version = app.getVersion();
    if (store.get('updatedWithVersion') !== version) {
      store.set('updatedWithVersion', version);
      logger.info({ version }, 'Settings file updated with version');
    }
  }
}

// デフォルトエクスポート
export default SettingsService;
