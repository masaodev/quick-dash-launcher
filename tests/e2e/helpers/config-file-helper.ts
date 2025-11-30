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

  // ==================== テンプレート読み込み（新API） ====================

  /**
   * テンプレートフォルダから全ファイルを読み込み
   * @param templateName テンプレート名（例: 'base', 'with-tabs'）
   *
   * テンプレートフォルダ内の以下のファイルを自動的にコピー：
   * - data.txt → configDir/data.txt
   * - data2.txt → configDir/data2.txt（存在する場合）
   * - data3.txt以降 → configDir/data*.txt（存在する場合）
   * - settings.json → configDir/settings.json（存在する場合）
   */
  loadTemplate(templateName: string): void {
    const templateDir = path.join(process.cwd(), 'tests', 'e2e', 'templates', templateName);

    if (!fs.existsSync(templateDir)) {
      throw new Error(`Template directory not found: ${templateDir}`);
    }

    // data.txt をコピー
    const dataTemplate = path.join(templateDir, 'data.txt');
    const dataTarget = path.join(this.configDir, 'data.txt');
    if (fs.existsSync(dataTemplate)) {
      fs.copyFileSync(dataTemplate, dataTarget);
    }

    // data2.txt〜data9.txt をコピー（存在する場合）
    for (let i = 2; i <= 9; i++) {
      const dataFile = `data${i}.txt`;
      const dataTemplate = path.join(templateDir, dataFile);
      const dataTarget = path.join(this.configDir, dataFile);
      if (fs.existsSync(dataTemplate)) {
        fs.copyFileSync(dataTemplate, dataTarget);
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
   * @param fileName ファイル名（例: 'data.txt', 'settings.json'）
   */
  loadTemplateFile(templateName: string, fileName: string): void {
    const templatePath = path.join(
      process.cwd(),
      'tests',
      'e2e',
      'templates',
      templateName,
      fileName
    );
    const targetPath = path.join(this.configDir, fileName);

    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, targetPath);
    } else {
      throw new Error(`Template file not found: ${templatePath}`);
    }
  }

  // ==================== データファイル操作（汎用） ====================

  /**
   * 指定したデータファイルの内容を読み込み
   * @param fileName ファイル名（例: 'data.txt', 'data2.txt', 'data3.txt'）
   * @returns ファイルの内容（存在しない場合は空文字列）
   */
  readDataFile(fileName: string): string {
    const dataFilePath = path.join(this.configDir, fileName);
    if (!fs.existsSync(dataFilePath)) {
      return '';
    }
    return fs.readFileSync(dataFilePath, 'utf8');
  }

  /**
   * 指定したデータファイルに内容を上書き
   * @param fileName ファイル名（例: 'data.txt', 'data2.txt', 'data3.txt'）
   * @param content ファイルの内容
   */
  writeDataFile(fileName: string, content: string): void {
    const dataFilePath = path.join(this.configDir, fileName);
    fs.writeFileSync(dataFilePath, content, 'utf8');
  }

  /**
   * 指定したデータファイルにアイテムを追加
   * @param fileName ファイル名（例: 'data.txt', 'data2.txt', 'data3.txt'）
   * @param name アイテム名
   * @param target アイテムのパス・URL
   */
  addItemToFile(fileName: string, name: string, target: string): void {
    const content = this.readDataFile(fileName);
    const newContent = content.trim() + `\n${name},${target}\n`;
    this.writeDataFile(fileName, newContent);
  }

  /**
   * 指定したデータファイルを削除
   * @param fileName ファイル名（例: 'data2.txt', 'data3.txt'）
   * @note data.txtは削除できません（必須ファイルのため）
   */
  deleteDataFile(fileName: string): void {
    if (fileName === 'data.txt') {
      throw new Error('data.txt is required and cannot be deleted');
    }
    const dataFilePath = path.join(this.configDir, fileName);
    if (fs.existsSync(dataFilePath)) {
      fs.unlinkSync(dataFilePath);
    }
  }

  // ==================== data.txt 操作（後方互換性のため残す） ====================

  /**
   * data.txtの内容を読み込み
   * @deprecated readDataFile('data.txt')を使用してください
   */
  readData(): string {
    return this.readDataFile('data.txt');
  }

  /**
   * data.txtの内容を上書き
   * @deprecated writeDataFile('data.txt', content)を使用してください
   */
  writeData(content: string): void {
    this.writeDataFile('data.txt', content);
  }

  /**
   * data.txtにアイテムを追加
   * @param name アイテム名
   * @param target アイテムのパス・URL
   * @deprecated addItemToFile('data.txt', name, target)を使用してください
   */
  addItem(name: string, target: string): void {
    this.addItemToFile('data.txt', name, target);
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

  // ==================== data2.txt/data3.txt 操作（後方互換性のため残す） ====================

  /**
   * data2.txtの内容を読み込み
   * @deprecated readDataFile('data2.txt')を使用してください
   */
  readData2(): string {
    return this.readDataFile('data2.txt');
  }

  /**
   * data2.txtの内容を上書き
   * @deprecated writeDataFile('data2.txt', content)を使用してください
   */
  writeData2(content: string): void {
    this.writeDataFile('data2.txt', content);
  }

  /**
   * data2.txtにアイテムを追加
   * @param name アイテム名
   * @param target アイテムのパス・URL
   * @deprecated addItemToFile('data2.txt', name, target)を使用してください
   */
  addItemToData2(name: string, target: string): void {
    this.addItemToFile('data2.txt', name, target);
  }

  /**
   * data2.txtを削除
   * @deprecated deleteDataFile('data2.txt')を使用してください
   */
  deleteData2(): void {
    this.deleteDataFile('data2.txt');
  }

  /**
   * data3.txtの内容を読み込み
   * @deprecated readDataFile('data3.txt')を使用してください
   */
  readData3(): string {
    return this.readDataFile('data3.txt');
  }

  /**
   * data3.txtの内容を上書き
   * @deprecated writeDataFile('data3.txt', content)を使用してください
   */
  writeData3(content: string): void {
    this.writeDataFile('data3.txt', content);
  }

  /**
   * data3.txtにアイテムを追加
   * @param name アイテム名
   * @param target アイテムのパス・URL
   * @deprecated addItemToFile('data3.txt', name, target)を使用してください
   */
  addItemToData3(name: string, target: string): void {
    this.addItemToFile('data3.txt', name, target);
  }

  /**
   * data3.txtを削除
   * @deprecated deleteDataFile('data3.txt')を使用してください
   */
  deleteData3(): void {
    this.deleteDataFile('data3.txt');
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
