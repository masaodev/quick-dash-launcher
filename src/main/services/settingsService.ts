import fs from 'node:fs';
import path from 'node:path';

import { app } from 'electron';
import {
  DEFAULT_DATA_FILE,
  DEFAULT_BOOKMARK_AUTO_IMPORT_SETTINGS,
  SETTINGS_FORMAT_VERSION,
} from '@common/types';
import type { AppSettings } from '@common/types';
import { validateHotkey } from '@common/utils/hotkeyValidator';
import { isNewerFormatVersion } from '@common/utils/formatVersion';
import { SETTING_NUMBER_RANGES } from '@common/settingRanges';
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
  /** まとめて書く（ファイルを読むのも書くのも 1 回） */
  set(values: Partial<AppSettings>): void;
  store: AppSettings;
  clear(): void;
  delete(key: string): void;
  path: string;
};

/**
 * アプリケーション設定を管理するサービスクラス
 * electron-storeを使用して設定の永続化を行う
 *
 * electron-store（conf）は値を読むたびに settings.json を読んでパースするので、読んだ内容をメモリに持つ（A3-254）。
 * 書いたとき・消したとき・F5（reloadFromDisk）で捨てて、次に読むときにファイルから読み直す。
 * QDL の外で settings.json を直したときは、F5 か CLI の reload で反映する
 */
export class SettingsService {
  private store: StoreInstance | null = null;
  /** settings.json の中身（パースしたもの）。null なら次に読むときにファイルから読む */
  private cache: Record<string, unknown> | null = null;
  /** 起動時に壊れていて退避した settings.json の行き先（退避しなかったら null） */
  private recoveredBrokenFile: string | null = null;
  /**
   * settings.json が新しい版の QDL で保存されたもの（settingsVersion が SETTINGS_FORMAT_VERSION より新しい）。
   * そのときはファイルに書かず、変えた設定は sessionOverrides に持って QDL を終了するまでだけ効かせる
   */
  private newerFormat = false;
  private sessionOverrides: Partial<AppSettings> = {};
  /** 初期化中・初期化済みのインスタンス（同時に呼ばれても初期化は 1 回だけ。全員が初期化の終わりを待つ） */
  private static instancePromise: Promise<SettingsService> | null = null;

  private static readonly DEFAULT_SETTINGS: AppSettings = {
    settingsVersion: SETTINGS_FORMAT_VERSION,
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
    searchSortByUsage: false,
    itemSearchHotkey: 'Ctrl+Alt+Space',
    bookmarkAutoImport: DEFAULT_BOOKMARK_AUTO_IMPORT_SETTINGS,
    detachedPositionMode: 'mainDisplay',
    windowSnapEnabled: true,
    recordLaunchUsage: true,
    updateCheckEnabled: true,
    updateCheckIncludeBeta: false,
    launchInheritEnvironment: true,
    adminItemColumns: { visible: {}, widths: {} },
  };

  private constructor() {}

  /** 設定値ではないメタ情報のキー（更新しても updatedWithVersion を進めない） */
  private static isMetadataKey(key: keyof AppSettings): boolean {
    return (
      key === 'settingsVersion' || key === 'createdWithVersion' || key === 'updatedWithVersion'
    );
  }

  /**
   * settings.json を設定として読めるか（JSON のオブジェクトか。ファイルが無ければ読める＝既定値で作る）
   *
   * 起動した後に QDL の外で壊すと、get は読むたびに失敗して既定値を返す。そのまま F5 で副作用
   * （自動起動・CLI・ホットキー）を適用し直すと、既定値で OS 側の設定を書き換えてしまうので、先に確かめる
   */
  public static isSettingsFileReadable(): boolean {
    const settingsFilePath = path.join(PathManager.getConfigFolder(), 'settings.json');
    let text: string;
    try {
      text = fs.readFileSync(settingsFilePath, 'utf-8');
    } catch {
      return !fs.existsSync(settingsFilePath);
    }
    try {
      const parsed: unknown = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
      return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
    } catch {
      return false;
    }
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
    // 新しい版の QDL が保存したファイルには既定値も書き足さない（electron-store は defaults を書き足すため渡さない）
    this.newerFormat = !isNewFile && SettingsService.isNewerFormatFile(settingsFilePath);
    if (this.newerFormat) {
      logger.warn(
        { settingsFilePath },
        'settings.json は新しい版の QDL で保存されています。設定を変えてもファイルには保存しません'
      );
    }

    const storeOptions = {
      name: 'settings',
      cwd: configFolder,
      defaults: this.newerFormat ? undefined : SettingsService.DEFAULT_SETTINGS,
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
      this.recoveredBrokenFile = dest;
      logger.warn(
        { error, brokenFile: dest },
        'settings.json を読めないため別名で退避し、既定値で起動します'
      );
      this.store = new Store(storeOptions) as StoreInstance;
      isNewFile = true;
    }

    if (isNewFile) {
      this.newerFormat = false;
      this.setCreatedWithVersion();
    }

    logger.info(`SettingsService initialized successfully at ${configFolder}`);
  }

  /** 起動時に壊れていて退避した settings.json の行き先（退避しなかったら null。起動時の知らせに使う） */
  public getRecoveredBrokenFile(): string | null {
    return this.recoveredBrokenFile;
  }

  /** settings.json が新しい版の QDL で保存されたもので、設定を保存していないか（起動時の知らせに使う） */
  public isNewerFormat(): boolean {
    return this.newerFormat;
  }

  /** settings.json の settingsVersion が、この QDL の扱える版より新しいか（読めなければ false。壊れたファイルは別に扱う） */
  private static isNewerFormatFile(settingsFilePath: string): boolean {
    try {
      const text = fs.readFileSync(settingsFilePath, 'utf8');
      const raw: unknown = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
      return (
        typeof raw === 'object' &&
        raw !== null &&
        isNewerFormatVersion(
          (raw as Record<string, unknown>).settingsVersion,
          SETTINGS_FORMAT_VERSION
        )
      );
    } catch {
      return false;
    }
  }

  /**
   * settings.json の中身（メモリに持っている写し）。持っていなければファイルから読む。
   * 読めなければ（QDL の外で壊したなど）例外を投げ、写しは持たない（直したら次に読むときに読める）
   */
  private readRaw(store: StoreInstance): Record<string, unknown> {
    this.cache ??= store.store as unknown as Record<string, unknown>;
    return this.cache;
  }

  /** メモリの写しを捨てる（書いた後・QDL の外で書き換わったかもしれないとき） */
  private invalidateCache(): void {
    this.cache = null;
  }

  /**
   * 次に読むときに settings.json をファイルから読み直す
   *
   * F5・CLI の reload（QDL の外で直した設定を反映する入口）と、スナップショットから戻した後に呼ぶ
   */
  public reloadFromDisk(): void {
    this.invalidateCache();
  }

  /** 新しい版のファイルのとき: その回だけの変更 → ファイルの値 → 既定値の順に読む */
  private readWithoutSaving<K extends keyof AppSettings>(
    store: StoreInstance,
    key: K
  ): AppSettings[K] {
    if (Object.prototype.hasOwnProperty.call(this.sessionOverrides, key)) {
      return this.sessionOverrides[key] as AppSettings[K];
    }
    const raw = this.readRaw(store);
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      return structuredClone(raw[key]) as AppSettings[K];
    }
    return structuredClone(SettingsService.DEFAULT_SETTINGS[key]);
  }

  /** ストアが初期化されていることを保証し、インスタンスを返す */
  private async ensureStore(): Promise<StoreInstance> {
    await this.initializeStore();
    if (!this.store) throw new Error('Store not initialized');
    return this.store;
  }

  public static getInstance(): Promise<SettingsService> {
    // 起動中はスプラッシュの言語の問い合わせと起動処理が同時に呼ぶ。インスタンスだけ先に返すと、
    // 初期化の途中で読み書きされ、ストアを 2 つ作ってしまう
    SettingsService.instancePromise ??= (async () => {
      const service = new SettingsService();
      await service.initializeStore();
      return service;
    })().catch((error: unknown) => {
      // 初期化に失敗したら、次に呼ばれたときにやり直す
      SettingsService.instancePromise = null;
      throw error;
    });
    return SettingsService.instancePromise;
  }

  /**
   * 範囲のある数値の設定を、使える値にして返す（ファイルは書き換えない）
   *
   * settings.json を手で直して範囲の外（`windowHeight: -5` など）や数値でない値にすると、
   * そのまま使えば高さ 39px のランチャーのような使えない画面になる。数値でなければ既定値に、
   * 範囲の外なら範囲の端に寄せる。設定画面で保存し直せばファイルも直る
   */
  private static sanitizeValue<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): AppSettings[K] {
    if (!Object.prototype.hasOwnProperty.call(SETTING_NUMBER_RANGES, key)) return value;
    const { min, max } = SETTING_NUMBER_RANGES[key as keyof typeof SETTING_NUMBER_RANGES];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return SettingsService.DEFAULT_SETTINGS[key];
    }
    return Math.min(max, Math.max(min, value)) as AppSettings[K];
  }

  /** getAll の結果の、範囲のある数値の設定を使える値にする（範囲の中なら同じオブジェクトを返す） */
  private static sanitizeAll(settings: AppSettings): AppSettings {
    let result: AppSettings | null = null;
    for (const key of Object.keys(SETTING_NUMBER_RANGES) as (keyof AppSettings)[]) {
      const next = SettingsService.sanitizeValue(key, settings[key]);
      if (next !== settings[key]) {
        result ??= { ...settings };
        (result as unknown as Record<string, unknown>)[key] = next;
      }
    }
    return result ?? settings;
  }

  public async get<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
    const store = await this.ensureStore();
    try {
      if (this.newerFormat) {
        return SettingsService.sanitizeValue(key, this.readWithoutSaving(store, key));
      }
      // 呼び出し元が返した値を書き換えても写しが変わらないよう、写しのコピーを返す
      const value = structuredClone(this.readRaw(store)[key]) as AppSettings[K];
      return SettingsService.sanitizeValue(key, value);
    } catch (error) {
      logger.error({ error, key }, 'Failed to get setting');
      return SettingsService.DEFAULT_SETTINGS[key];
    }
  }

  public async set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    await this.ensureStore();
    if (this.newerFormat) {
      this.sessionOverrides[key] = value;
      logger.info({ key, value }, 'Setting updated (not saved: settings.json is a newer format)');
      return;
    }
    await this.setMultiple({ [key]: value } as Partial<AppSettings>, { log: false });
    logger.info({ key, value }, 'Setting updated');
  }

  /**
   * 設定から外した古いキーの値を読む（ファイルに残っているものだけ）。読み替えた後に deleteRemovedKeys で消す
   */
  public async readRemovedKeys(keys: readonly string[]): Promise<Record<string, unknown>> {
    const store = await this.ensureStore();
    const raw = this.readRaw(store);
    const found: Record<string, unknown> = {};
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) found[key] = raw[key];
    }
    return found;
  }

  /** 設定から外した古いキーを消す（新しい版の QDL が保存したファイルからは消さない） */
  public async deleteRemovedKeys(keys: readonly string[]): Promise<void> {
    const store = await this.ensureStore();
    if (this.newerFormat) return;
    try {
      for (const key of keys) store.delete(key);
    } finally {
      this.invalidateCache();
    }
  }

  /**
   * 設定をまとめて保存する（ファイルを読むのも書くのも 1 回。設定値を変えたら版の記録も同じ書き込みに入れる）
   * @param options.log 「Multiple settings updated」のログを出すか（set から呼ぶときは set のログだけにする）
   */
  public async setMultiple(
    settings: Partial<AppSettings>,
    options: { log?: boolean } = {}
  ): Promise<void> {
    const { log = true } = options;
    const store = await this.ensureStore();
    if (this.newerFormat) {
      for (const [key, value] of Object.entries(settings)) {
        if (value !== undefined) {
          (this.sessionOverrides as Record<string, unknown>)[key] = value;
        }
      }
      logger.info({ settings }, 'Multiple settings updated (not saved: newer format)');
      return;
    }
    const values: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) values[key] = value;
    }
    const hasNonMetadataKey = Object.keys(values).some(
      (key) => !SettingsService.isMetadataKey(key as keyof AppSettings)
    );
    if (hasNonMetadataKey) {
      const version = this.versionToRecord(store);
      if (version) values.updatedWithVersion = version;
    }

    if (Object.keys(values).length > 0) {
      try {
        store.set(values as Partial<AppSettings>);
      } finally {
        // 書けたときも書けなかったときも、次はファイルの今の中身を読む
        this.invalidateCache();
      }
    }

    if (log) logger.info({ settings }, 'Multiple settings updated');
  }

  /**
   * 旧設定「グループアイテムを並列起動」の値（グループをセットに変換するときの開き方に写す）
   *
   * 設定の項目からは消したので、保存されている値をそのまま読む
   */
  public async getLegacyParallelGroupLaunch(): Promise<boolean> {
    const store = await this.ensureStore();
    try {
      return this.readRaw(store).parallelGroupLaunch === true;
    } catch {
      return false;
    }
  }

  public async getAll(): Promise<AppSettings> {
    const store = await this.ensureStore();
    try {
      if (this.newerFormat) {
        return SettingsService.sanitizeAll({
          ...structuredClone(SettingsService.DEFAULT_SETTINGS),
          ...structuredClone(this.readRaw(store)),
          ...this.sessionOverrides,
        });
      }
      // 呼び出し元が書き換えても写しが変わらないよう、コピーを返す
      return SettingsService.sanitizeAll(
        structuredClone(this.readRaw(store)) as unknown as AppSettings
      );
    } catch (error) {
      logger.error({ error }, 'Failed to get all settings');
      return SettingsService.DEFAULT_SETTINGS;
    }
  }

  public async reset(): Promise<void> {
    const store = await this.ensureStore();
    if (this.newerFormat) {
      const { settingsVersion: _version, ...defaults } = structuredClone(
        SettingsService.DEFAULT_SETTINGS
      );
      this.sessionOverrides = defaults;
      logger.info('Settings reset to defaults (not saved: newer format)');
      return;
    }
    try {
      store.clear();
    } finally {
      this.invalidateCache();
    }
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
    try {
      this.store.set({ createdWithVersion: version, updatedWithVersion: version });
    } finally {
      this.invalidateCache();
    }
    logger.info({ version }, 'Settings file created with version');
  }

  /** 版の記録を進める必要があれば、記録する版を返す（今の版がもう記録されていれば null） */
  private versionToRecord(store: StoreInstance): string | null {
    const version = app.getVersion();
    let recorded: unknown;
    try {
      recorded = this.readRaw(store).updatedWithVersion;
    } catch {
      recorded = undefined;
    }
    if (recorded === version) return null;
    logger.info({ version }, 'Settings file updated with version');
    return version;
  }
}

// デフォルトエクスポート
export default SettingsService;
