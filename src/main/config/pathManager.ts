import * as path from 'path';
import * as fs from 'fs';

import { app } from 'electron';
import logger from '@common/logger';

import { EnvConfig } from './envConfig.js';

/**
 * アプリケーションの設定ファイル・ディレクトリのパスを管理するクラス
 *
 * 環境変数 QUICK_DASH_CONFIG_DIR を使用してカスタムパスを指定可能
 * テスト時には setConfigFolderForTesting() でパスをオーバーライド可能
 */
export class PathManager {
  private static configFolder: string | null = null;

  // ============================================================
  // ディレクトリパス取得
  // ============================================================

  /** 設定フォルダのベースパスを取得 */
  static getConfigFolder(): string {
    if (this.configFolder) {
      return this.configFolder;
    }

    if (EnvConfig.customConfigDir) {
      const customPath = path.resolve(EnvConfig.customConfigDir);

      if (this.isUnsafePath(customPath)) {
        logger.warn(`Unsafe config path detected: ${customPath}. Using default path instead.`);
        return this.getDefaultConfigPath();
      }

      logger.info(`Using custom config path: ${customPath}`);
      return customPath;
    }

    return this.getDefaultConfigPath();
  }

  /** アイコンキャッシュのベースフォルダパスを取得 */
  static getIconCacheFolder(): string {
    return path.join(this.getConfigFolder(), 'icon-cache');
  }

  /** アプリケーションアイコンフォルダのパスを取得 */
  static getAppsFolder(): string {
    return this.getIconCacheSubfolder('apps');
  }

  /** faviconフォルダのパスを取得 */
  static getFaviconsFolder(): string {
    return this.getIconCacheSubfolder('favicons');
  }

  /** カスタムアイコンフォルダのパスを取得 */
  static getCustomIconsFolder(): string {
    return this.getIconCacheSubfolder('custom');
  }

  /** スキームアイコンフォルダのパスを取得 */
  static getSchemesFolder(): string {
    return this.getIconCacheSubfolder('schemes');
  }

  /** 拡張子アイコンフォルダのパスを取得 */
  static getExtensionsFolder(): string {
    return this.getIconCacheSubfolder('extensions');
  }

  /** バックアップフォルダのパスを取得 */
  static getBackupFolder(): string {
    return path.join(this.getConfigFolder(), 'backup');
  }

  // ============================================================
  // ファイルパス取得
  // ============================================================

  /** data.jsonファイルのパスを取得 */
  static getDataFilePath(): string {
    return path.join(this.getConfigFolder(), 'data.json');
  }

  /** workspace.jsonファイルのパスを取得 */
  static getWorkspaceFilePath(): string {
    return path.join(this.getConfigFolder(), 'workspace.json');
  }

  /**
   * 設定フォルダ内のすべてのdata*ファイル（.json）を取得
   *
   * @returns データファイル名の配列（例: ['data.json', 'data2.json']）
   */
  static getDataFiles(): string[] {
    const configFolder = this.getConfigFolder();

    try {
      if (!fs.existsSync(configFolder)) {
        logger.warn(`Config folder does not exist: ${configFolder}`);
        return [];
      }

      const files = fs.readdirSync(configFolder);

      // JSON形式のデータファイルのみ収集
      const jsonFiles = files
        .filter((file) => file.startsWith('data') && file.endsWith('.json'))
        .sort();

      logger.info(`Found ${jsonFiles.length} data files: ${jsonFiles.join(', ')}`);
      return jsonFiles;
    } catch (error) {
      logger.error({ error, configFolder }, 'Failed to read data files');
      return [];
    }
  }

  /**
   * アプリケーションアイコンのパスを取得
   * 開発モード時は専用のアイコン（icon-dev.ico）を使用
   */
  static getAppIconPath(): string {
    const iconFileName = EnvConfig.isDevelopment ? 'icon-dev.ico' : 'icon.ico';

    if (EnvConfig.isDevelopment) {
      return path.join(process.cwd(), 'assets', iconFileName);
    }
    // 本番モード: dist/main/main.jsから2階層上がってassetsフォルダへ
    return path.join(__dirname, '../../assets', iconFileName);
  }

  // ============================================================
  // ディレクトリ操作
  // ============================================================

  /** 必要なディレクトリを作成 */
  static ensureDirectories(): void {
    const dirs = [
      this.getConfigFolder(),
      this.getIconCacheFolder(),
      this.getAppsFolder(),
      this.getSchemesFolder(),
      this.getExtensionsFolder(),
      this.getFaviconsFolder(),
      this.getCustomIconsFolder(),
      this.getBackupFolder(),
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          logger.info(`Created directory: ${dir}`);
        } catch (error) {
          logger.error({ error, dir }, 'Failed to create directory');
          throw error;
        }
      }
    }
  }

  /** 設定フォルダが書き込み可能かチェック */
  static isConfigFolderWritable(): boolean {
    const configFolder = this.getConfigFolder();

    try {
      if (!fs.existsSync(configFolder)) {
        fs.mkdirSync(configFolder, { recursive: true });
      }

      const testFile = path.join(configFolder, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      return true;
    } catch (error) {
      logger.error({ error, configFolder }, 'Config folder is not writable');
      return false;
    }
  }

  // ============================================================
  // テスト用ユーティリティ
  // ============================================================

  /** テスト用に設定フォルダをオーバーライド */
  static setConfigFolderForTesting(customPath: string): void {
    this.configFolder = path.resolve(customPath);
    logger.info(`Config folder overridden for testing: ${this.configFolder}`);
  }

  /** 設定フォルダのオーバーライドをリセット */
  static resetConfigFolder(): void {
    this.configFolder = null;
    logger.info('Config folder override reset');
  }

  // ============================================================
  // プライベートヘルパー
  // ============================================================

  /** デフォルトの設定フォルダパスを取得 */
  private static getDefaultConfigPath(): string {
    return path.join(app.getPath('userData'), 'config');
  }

  /** アイコンキャッシュ配下のサブフォルダパスを取得 */
  private static getIconCacheSubfolder(subfolder: string): string {
    return path.join(this.getIconCacheFolder(), subfolder);
  }

  /** 危険なパスかどうかをチェック */
  private static isUnsafePath(targetPath: string): boolean {
    const unsafePaths = [
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      '/bin',
      '/sbin',
      '/usr',
      '/etc',
      '/System',
    ];

    const normalizedPath = path.normalize(targetPath).toLowerCase();

    return unsafePaths.some((unsafePath) => {
      const normalizedUnsafe = path.normalize(unsafePath).toLowerCase();
      return (
        normalizedPath === normalizedUnsafe ||
        normalizedPath.startsWith(normalizedUnsafe + path.sep)
      );
    });
  }
}

export default PathManager;
