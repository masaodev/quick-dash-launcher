import fs from 'fs';
import path from 'path';

import type { AppSettings } from '@common/types';

/**
 * E2Eテスト用の設定ファイル管理ヘルパー
 * data.txtとsettings.jsonの両方をバックアップ・復元・変更できる
 */
export class ConfigFileHelper {
  private dataBackupPath: string | null = null;
  private settingsBackupPath: string | null = null;
  private isTempDir: boolean = false;

  constructor(private configDir: string) {}

  /**
   * テンプレートから一時ディレクトリを作成して初期化
   * @param testName テスト名（ディレクトリ名に使用）
   * @returns 作成された一時ディレクトリのパス
   */
  static createTempConfigDir(testName: string): ConfigFileHelper {
    const tempDir = path.join(process.cwd(), 'tests', 'e2e', 'configs', '.temp', testName);

    // 既存のディレクトリがあれば削除
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // 一時ディレクトリを作成
    fs.mkdirSync(tempDir, { recursive: true });

    // テンプレートからdata.txtをコピー
    const dataTemplate = path.join(
      process.cwd(),
      'tests',
      'e2e',
      'templates',
      'data',
      'base.txt'
    );
    const dataTarget = path.join(tempDir, 'data.txt');

    if (fs.existsSync(dataTemplate)) {
      fs.copyFileSync(dataTemplate, dataTarget);
    }

    const helper = new ConfigFileHelper(tempDir);
    helper.isTempDir = true;
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
   * data.txtとsettings.jsonの両方をバックアップ
   */
  backupAll(): void {
    this.backupData();
    this.backupSettings();
  }

  /**
   * data.txtとsettings.jsonの両方を復元
   */
  restoreAll(): void {
    this.restoreData();
    this.restoreSettings();
  }

  /**
   * data.txtをバックアップ
   */
  backupData(): void {
    const dataFilePath = path.join(this.configDir, 'data.txt');
    this.dataBackupPath = path.join(this.configDir, '.data.txt.backup');

    if (fs.existsSync(dataFilePath)) {
      fs.copyFileSync(dataFilePath, this.dataBackupPath);
    }
  }

  /**
   * data.txtを復元
   */
  restoreData(): void {
    if (!this.dataBackupPath) return;

    const dataFilePath = path.join(this.configDir, 'data.txt');

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

  // ==================== data.txt 操作 ====================

  /**
   * data.txtの内容を読み込み
   */
  readData(): string {
    const dataFilePath = path.join(this.configDir, 'data.txt');
    if (!fs.existsSync(dataFilePath)) {
      return '';
    }
    return fs.readFileSync(dataFilePath, 'utf8');
  }

  /**
   * data.txtの内容を上書き
   */
  writeData(content: string): void {
    const dataFilePath = path.join(this.configDir, 'data.txt');
    fs.writeFileSync(dataFilePath, content, 'utf8');
  }

  /**
   * data.txtにアイテムを追加
   * @param name アイテム名
   * @param target アイテムのパス・URL
   */
  addItem(name: string, target: string): void {
    const content = this.readData();
    const newContent = content.trim() + `\n${name},${target}\n`;
    this.writeData(newContent);
  }

  /**
   * data.txtから特定のアイテムを削除
   * @param name 削除するアイテム名
   */
  removeItem(name: string): void {
    const lines = this.readData().split('\n');
    const filtered = lines.filter((line) => {
      const trimmed = line.trim();
      // コメント行や空行は残す
      if (!trimmed || trimmed.startsWith('//')) {
        return true;
      }
      // アイテム行の場合、名前が一致しないものだけ残す
      return !trimmed.startsWith(`${name},`);
    });
    this.writeData(filtered.join('\n'));
  }

  /**
   * data.txtの特定のアイテムを更新
   * @param oldName 既存のアイテム名
   * @param newName 新しいアイテム名
   * @param newTarget 新しいターゲット
   */
  updateItem(oldName: string, newName: string, newTarget: string): void {
    const lines = this.readData().split('\n');
    const updated = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith(`${oldName},`)) {
        return `${newName},${newTarget}`;
      }
      return line;
    });
    this.writeData(updated.join('\n'));
  }

  /**
   * テンプレートからdata.txtを読み込み
   * @param templateName テンプレート名（例: 'base', 'with-group'）
   */
  loadDataTemplate(templateName: string): void {
    const templatePath = path.join(
      process.cwd(),
      'tests',
      'e2e',
      'templates',
      'data',
      `${templateName}.txt`
    );
    const dataFilePath = path.join(this.configDir, 'data.txt');

    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, dataFilePath);
    } else {
      throw new Error(`Template not found: ${templatePath}`);
    }
  }

  /**
   * テンプレートからdata.txtを強制的に復元（テスト前の初期化用）
   * @param templateName テンプレート名（デフォルト: 'base'）
   */
  restoreDataFromTemplate(templateName: string = 'base'): void {
    this.loadDataTemplate(templateName);
  }

  // ==================== data2.txt 操作（サブタブ用） ====================

  /**
   * data2.txtの内容を読み込み
   */
  readData2(): string {
    const dataFilePath = path.join(this.configDir, 'data2.txt');
    if (!fs.existsSync(dataFilePath)) {
      return '';
    }
    return fs.readFileSync(dataFilePath, 'utf8');
  }

  /**
   * data2.txtの内容を上書き
   */
  writeData2(content: string): void {
    const dataFilePath = path.join(this.configDir, 'data2.txt');
    fs.writeFileSync(dataFilePath, content, 'utf8');
  }

  /**
   * data2.txtにアイテムを追加
   * @param name アイテム名
   * @param target アイテムのパス・URL
   */
  addItemToData2(name: string, target: string): void {
    const content = this.readData2();
    const newContent = content.trim() + `\n${name},${target}\n`;
    this.writeData2(newContent);
  }

  /**
   * テンプレートからdata2.txtを読み込み
   * @param templateName テンプレート名（例: 'data2-base'）
   */
  loadData2Template(templateName: string): void {
    const templatePath = path.join(
      process.cwd(),
      'tests',
      'e2e',
      'templates',
      'data',
      `${templateName}.txt`
    );
    const dataFilePath = path.join(this.configDir, 'data2.txt');

    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, dataFilePath);
    } else {
      throw new Error(`Template not found: ${templatePath}`);
    }
  }

  /**
   * data2.txtを削除
   */
  deleteData2(): void {
    const dataFilePath = path.join(this.configDir, 'data2.txt');
    if (fs.existsSync(dataFilePath)) {
      fs.unlinkSync(dataFilePath);
    }
  }

  /**
   * テンプレートからdata2.txtを強制的に復元（テスト前の初期化用）
   * @param templateName テンプレート名（デフォルト: 'data2-base'）
   */
  restoreData2FromTemplate(templateName: string = 'data2-base'): void {
    this.loadData2Template(templateName);
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
   * テンプレートからsettings.jsonを読み込み
   * @param templateName テンプレート名（例: 'default', 'custom-hotkey'）
   */
  loadSettingsTemplate(templateName: string): void {
    const templatePath = path.join(
      process.cwd(),
      'tests',
      'e2e',
      'templates',
      'settings',
      `${templateName}.json`
    );
    const settingsFilePath = path.join(this.configDir, 'settings.json');

    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, settingsFilePath);
    } else {
      throw new Error(`Template not found: ${templatePath}`);
    }
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

  /**
   * テンプレートからsettings.jsonを強制的に復元（テスト前の初期化用）
   * @param templateName テンプレート名（デフォルト: 'base'）
   */
  restoreSettingsFromTemplate(templateName: string = 'base'): void {
    this.loadSettingsTemplate(templateName);
  }

  // ==================== ユーティリティ ====================

  /**
   * 設定ディレクトリのパスを取得
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * data.txtのフルパスを取得
   */
  getDataPath(): string {
    return path.join(this.configDir, 'data.txt');
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
    const filePath = path.join(this.configDir, fileName);
    return fs.existsSync(filePath);
  }
}
