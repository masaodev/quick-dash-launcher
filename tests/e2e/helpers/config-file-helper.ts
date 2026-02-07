import fs from 'fs';
import path from 'path';

import type { AppSettings, JsonItem, JsonLauncherItem } from '@common/types';

/** データファイルのJSON構造 */
interface DataFileContent {
  version: string;
  items: JsonItem[];
}

/**
 * E2Eテスト用の設定ファイル管理ヘルパー
 * data.jsonとsettings.jsonの両方をバックアップ・復元・変更できる
 */
export class ConfigFileHelper {
  private dataBackupPath: string | null = null;
  private settingsBackupPath: string | null = null;
  private isTempDir: boolean = false;
  private dataFilesDir: string;

  constructor(private configDir: string) {
    this.dataFilesDir = path.join(configDir, 'datafiles');
  }

  /**
   * テンプレートから一時ディレクトリを作成して初期化
   * @param testName テスト名（ディレクトリ名に使用）
   * @param templateName テンプレート名（デフォルト: 'base'）
   * @returns 作成された一時ディレクトリのパス
   */
  static createTempConfigDir(testName: string, templateName: string = 'base'): ConfigFileHelper {
    const tempDir = path.join(process.cwd(), 'tests', 'e2e', 'configs', '.temp', testName);

    // 既存のディレクトリがあれば削除
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // 一時ディレクトリを作成
    fs.mkdirSync(tempDir, { recursive: true });

    // ヘルパーインスタンスを作成してテンプレートを読み込み
    const helper = new ConfigFileHelper(tempDir);
    helper.isTempDir = true;
    helper.loadTemplate(templateName);
    return helper;
  }

  /**
   * 一時ディレクトリを削除
   */
  cleanup(): void {
    if (this.isTempDir && fs.existsSync(this.configDir)) {
      fs.rmSync(this.configDir, { recursive: true, force: true });
    }
  }

  // ==================== バックアップ・復元 ====================

  /**
   * data.jsonとsettings.jsonの両方をバックアップ
   */
  backupAll(): void {
    this.backupData();
    this.backupSettings();
  }

  /**
   * data.jsonとsettings.jsonの両方を復元
   */
  restoreAll(): void {
    this.restoreData();
    this.restoreSettings();
  }

  /**
   * data.jsonをバックアップ
   */
  backupData(): void {
    const dataFilePath = path.join(this.dataFilesDir, 'data.json');
    this.dataBackupPath = path.join(this.configDir, '.data.json.backup');

    if (fs.existsSync(dataFilePath)) {
      fs.copyFileSync(dataFilePath, this.dataBackupPath);
    }
  }

  /**
   * data.jsonを復元
   */
  restoreData(): void {
    if (!this.dataBackupPath) return;

    const dataFilePath = path.join(this.dataFilesDir, 'data.json');

    if (fs.existsSync(this.dataBackupPath)) {
      fs.copyFileSync(this.dataBackupPath, dataFilePath);
      fs.unlinkSync(this.dataBackupPath);
    }

    this.dataBackupPath = null;
  }

  /**
   * settings.jsonをバックアップ
   */
  backupSettings(): void {
    const settingsFilePath = path.join(this.configDir, 'settings.json');
    this.settingsBackupPath = path.join(this.configDir, '.settings.json.backup');

    if (fs.existsSync(settingsFilePath)) {
      fs.copyFileSync(settingsFilePath, this.settingsBackupPath);
    }
  }

  /**
   * settings.jsonを復元
   */
  restoreSettings(): void {
    if (!this.settingsBackupPath) return;

    const settingsFilePath = path.join(this.configDir, 'settings.json');

    if (fs.existsSync(this.settingsBackupPath)) {
      fs.copyFileSync(this.settingsBackupPath, settingsFilePath);
      fs.unlinkSync(this.settingsBackupPath);
    }

    this.settingsBackupPath = null;
  }

  // ==================== テンプレート読み込み（新API） ====================

  /**
   * テンプレートフォルダから全ファイルを読み込み
   * @param templateName テンプレート名（例: 'base', 'with-tabs'）
   *
   * テンプレートフォルダ内の以下のファイルを自動的にコピー：
   * - data.json → configDir/data.json
   * - data2.json → configDir/data2.json（存在する場合）
   * - data3.json以降 → configDir/data*.json（存在する場合）
   * - settings.json → configDir/settings.json（存在する場合）
   */
  loadTemplate(templateName: string): void {
    const templateDir = path.join(process.cwd(), 'tests', 'e2e', 'templates', templateName);

    if (!fs.existsSync(templateDir)) {
      throw new Error(`Template directory not found: ${templateDir}`);
    }

    // datafilesディレクトリを作成
    fs.mkdirSync(this.dataFilesDir, { recursive: true });

    // テンプレートのdatafilesサブディレクトリからdata*.jsonをコピー
    const templateDataFilesDir = path.join(templateDir, 'datafiles');

    if (fs.existsSync(templateDataFilesDir)) {
      // 新形式: テンプレートにdatafilesディレクトリがある場合
      const files = fs.readdirSync(templateDataFilesDir);
      for (const file of files) {
        if (file.startsWith('data') && file.endsWith('.json')) {
          fs.copyFileSync(
            path.join(templateDataFilesDir, file),
            path.join(this.dataFilesDir, file)
          );
        }
      }
    } else {
      // 旧形式の互換: テンプレート直下のdata*.jsonをdatafilesにコピー
      const dataTemplate = path.join(templateDir, 'data.json');
      if (fs.existsSync(dataTemplate)) {
        fs.copyFileSync(dataTemplate, path.join(this.dataFilesDir, 'data.json'));
      }

      for (let i = 2; i <= 9; i++) {
        const dataFile = `data${i}.json`;
        const srcPath = path.join(templateDir, dataFile);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, path.join(this.dataFilesDir, dataFile));
        }
      }
    }

    // settings.json をコピー（存在する場合）
    const settingsTemplate = path.join(templateDir, 'settings.json');
    const settingsTarget = path.join(this.configDir, 'settings.json');
    if (fs.existsSync(settingsTemplate)) {
      fs.copyFileSync(settingsTemplate, settingsTarget);
    }
  }

  /**
   * テンプレートフォルダから特定のファイルのみ読み込み
   * @param templateName テンプレート名（例: 'base', 'with-tabs'）
   * @param fileName ファイル名（例: 'data.json', 'settings.json'）
   */
  loadTemplateFile(templateName: string, fileName: string): void {
    const isDataFile = fileName.startsWith('data') && fileName.endsWith('.json');
    const templateBase = path.join(process.cwd(), 'tests', 'e2e', 'templates', templateName);

    // datafilesサブディレクトリを優先、なければテンプレート直下から読む
    let templatePath: string;
    if (isDataFile) {
      const dataFilesPath = path.join(templateBase, 'datafiles', fileName);
      templatePath = fs.existsSync(dataFilesPath)
        ? dataFilesPath
        : path.join(templateBase, fileName);
    } else {
      templatePath = path.join(templateBase, fileName);
    }

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    if (isDataFile) {
      fs.mkdirSync(this.dataFilesDir, { recursive: true });
      fs.copyFileSync(templatePath, path.join(this.dataFilesDir, fileName));
    } else {
      fs.copyFileSync(templatePath, path.join(this.configDir, fileName));
    }
  }

  // ==================== データファイル操作（汎用） ====================

  /**
   * 指定したデータファイルの内容を読み込み（JSON形式）
   * @param fileName ファイル名（例: 'data.json', 'data2.json', 'data3.json'）
   * @returns ファイルの内容（存在しない場合は空のデータ構造）
   */
  readDataFile(fileName: string): DataFileContent {
    const dataFilePath = path.join(this.dataFilesDir, fileName);
    if (!fs.existsSync(dataFilePath)) {
      return { version: '1.0', items: [] };
    }
    const content = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(content) as DataFileContent;
  }

  /**
   * 指定したデータファイルの内容を読み込み（生の文字列として）
   * @param fileName ファイル名
   * @returns ファイルの内容文字列（存在しない場合は空文字列）
   */
  readDataFileRaw(fileName: string): string {
    const dataFilePath = path.join(this.dataFilesDir, fileName);
    if (!fs.existsSync(dataFilePath)) {
      return '';
    }
    return fs.readFileSync(dataFilePath, 'utf8');
  }

  /**
   * 指定したデータファイルに内容を上書き（JSON形式）
   * @param fileName ファイル名（例: 'data.json', 'data2.json', 'data3.json'）
   * @param content ファイルの内容
   */
  writeDataFile(fileName: string, content: DataFileContent): void {
    const dataFilePath = path.join(this.dataFilesDir, fileName);
    fs.writeFileSync(dataFilePath, JSON.stringify(content, null, '  '), 'utf8');
  }

  /**
   * 指定したデータファイルに内容を上書き（生の文字列として）
   * @param fileName ファイル名
   * @param content ファイルの内容文字列
   */
  writeDataFileRaw(fileName: string, content: string): void {
    const dataFilePath = path.join(this.dataFilesDir, fileName);
    fs.writeFileSync(dataFilePath, content, 'utf8');
  }

  /**
   * 指定したデータファイルにアイテムを追加（JSON形式）
   * @param fileName ファイル名（例: 'data.json', 'data2.json', 'data3.json'）
   * @param item 追加するアイテム
   */
  addItemToFile(fileName: string, item: JsonItem): void {
    const data = this.readDataFile(fileName);
    data.items.push(item);
    this.writeDataFile(fileName, data);
  }

  /**
   * 簡易的なアイテム追加（displayNameとpathのみ指定）
   * @param fileName ファイル名
   * @param displayName 表示名
   * @param itemPath アイテムのパス・URL
   */
  addSimpleItem(fileName: string, displayName: string, itemPath: string): void {
    const id = this.generateId();
    const item: JsonLauncherItem = {
      id,
      type: 'item',
      displayName,
      path: itemPath,
    };
    this.addItemToFile(fileName, item);
  }

  /**
   * 8文字のユニークIDを生成
   */
  private generateId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /**
   * 指定したデータファイルを削除
   * @param fileName ファイル名（例: 'data2.json', 'data3.json'）
   * @note data.jsonは削除できません（必須ファイルのため）
   */
  deleteDataFile(fileName: string): void {
    if (fileName === 'data.json') {
      throw new Error('data.json is required and cannot be deleted');
    }
    const dataFilePath = path.join(this.dataFilesDir, fileName);
    if (fs.existsSync(dataFilePath)) {
      fs.unlinkSync(dataFilePath);
    }
  }

  // ==================== settings.json 操作 ====================

  /**
   * settings.jsonの内容を読み込み
   */
  readSettings(): Partial<AppSettings> {
    const settingsFilePath = path.join(this.configDir, 'settings.json');
    if (!fs.existsSync(settingsFilePath)) {
      return {};
    }
    const content = fs.readFileSync(settingsFilePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * settings.jsonの内容を上書き
   */
  writeSettings(settings: Partial<AppSettings>): void {
    const settingsFilePath = path.join(this.configDir, 'settings.json');
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, '\t'), 'utf8');
  }

  /**
   * settings.jsonの特定の設定項目を更新
   * @param key 設定キー
   * @param value 設定値
   */
  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    const settings = this.readSettings();
    settings[key] = value;
    this.writeSettings(settings);
  }

  /**
   * settings.jsonの複数の設定項目を一括更新
   * @param updates 更新する設定オブジェクト
   */
  updateSettings(updates: Partial<AppSettings>): void {
    const settings = this.readSettings();
    const merged = { ...settings, ...updates };
    this.writeSettings(merged);
  }

  /**
   * settings.jsonを削除（初回起動状態を再現）
   */
  deleteSettings(): void {
    const settingsFilePath = path.join(this.configDir, 'settings.json');
    if (fs.existsSync(settingsFilePath)) {
      fs.unlinkSync(settingsFilePath);
    }
  }

  // ==================== ユーティリティ ====================

  /**
   * 設定ディレクトリのパスを取得
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * data.jsonのフルパスを取得
   */
  getDataPath(): string {
    return path.join(this.dataFilesDir, 'data.json');
  }

  /**
   * datafilesディレクトリのパスを取得
   */
  getDataFilesDir(): string {
    return this.dataFilesDir;
  }

  /**
   * settings.jsonのフルパスを取得
   */
  getSettingsPath(): string {
    return path.join(this.configDir, 'settings.json');
  }

  /**
   * 特定のファイルが存在するか確認
   */
  fileExists(fileName: string): boolean {
    const isDataFile = fileName.startsWith('data') && fileName.endsWith('.json');
    const dir = isDataFile ? this.dataFilesDir : this.configDir;
    const filePath = path.join(dir, fileName);
    return fs.existsSync(filePath);
  }

  // ==================== 検証ヘルパー ====================

  /**
   * アイテムがdisplayNameを持つかチェック（型ガード用ヘルパー）
   */
  private hasDisplayName(item: JsonItem): item is JsonItem & { displayName: string } {
    return item.type !== 'dir';
  }

  /**
   * アイテムがpathを持つかチェック（型ガード用ヘルパー）
   */
  private hasPath(item: JsonItem): item is JsonItem & { path: string } {
    return item.type !== 'group';
  }

  /**
   * データファイル内に指定した表示名のアイテムが存在するかチェック
   */
  hasItemByDisplayName(fileName: string, displayName: string): boolean {
    const data = this.readDataFile(fileName);
    return data.items.some((item) => this.hasDisplayName(item) && item.displayName === displayName);
  }

  /**
   * データファイル内に指定したパスのアイテムが存在するかチェック
   */
  hasItemByPath(fileName: string, itemPath: string): boolean {
    const data = this.readDataFile(fileName);
    return data.items.some((item) => this.hasPath(item) && item.path === itemPath);
  }

  /**
   * データファイル内に指定した表示名とパスを持つアイテムが存在するかチェック
   */
  hasItem(fileName: string, displayName: string, itemPath: string): boolean {
    const data = this.readDataFile(fileName);
    return data.items.some(
      (item) =>
        this.hasDisplayName(item) &&
        this.hasPath(item) &&
        item.displayName === displayName &&
        item.path === itemPath
    );
  }

  /**
   * データファイル内の指定した表示名のアイテムを取得
   */
  getItemByDisplayName(fileName: string, displayName: string): JsonItem | undefined {
    const data = this.readDataFile(fileName);
    return data.items.find((item) => {
      if (!this.hasDisplayName(item)) return false;
      return item.displayName === displayName;
    });
  }

  /**
   * データファイル内の指定したパスのアイテムを取得
   */
  getItemByPath(fileName: string, itemPath: string): JsonItem | undefined {
    const data = this.readDataFile(fileName);
    return data.items.find((item) => {
      if (!this.hasPath(item)) return false;
      return item.path === itemPath;
    });
  }

  /**
   * データファイルの内容に指定した文字列が含まれるかチェック（後方互換用）
   * 注: JSON形式でも文字列検索で使用可能
   */
  dataFileContains(fileName: string, searchString: string): boolean {
    const rawContent = this.readDataFileRaw(fileName);
    return rawContent.includes(searchString);
  }
}
