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

  static getIconCacheFolder(): string {
    return path.join(this.getConfigFolder(), 'icon-cache');
  }

  static getAppsFolder(): string {
    return this.getIconCacheSubfolder('apps');
  }

  static getFaviconsFolder(): string {
    return this.getIconCacheSubfolder('favicons');
  }

  static getCustomIconsFolder(): string {
    return this.getIconCacheSubfolder('custom');
  }

  static getSchemesFolder(): string {
    return this.getIconCacheSubfolder('schemes');
  }

  static getExtensionsFolder(): string {
    return this.getIconCacheSubfolder('extensions');
  }

  static getBackupFolder(): string {
    return path.join(this.getConfigFolder(), 'backup');
  }

  static getClipboardDataFolder(): string {
    return path.join(this.getConfigFolder(), 'clipboard-data');
  }

  static getClipboardDataFilePath(id: string): string {
    return path.join(this.getClipboardDataFolder(), `${id}.json`);
  }

  static getDataFilesFolder(): string {
    return path.join(this.getConfigFolder(), 'datafiles');
  }

  static getDataFilePath(): string {
    return path.join(this.getDataFilesFolder(), 'data.json');
  }

  static getWorkspaceFilePath(): string {
    return path.join(this.getConfigFolder(), 'workspace.json');
  }

  /** datafilesフォルダ内のすべてのdata*.jsonファイルを取得（configFolderからの相対パス） */
  static getDataFiles(): string[] {
    const dataFilesFolder = this.getDataFilesFolder();

    try {
      if (!fs.existsSync(dataFilesFolder)) {
        logger.warn(`Data files folder does not exist: ${dataFilesFolder}`);
        return [];
      }

      const files = fs.readdirSync(dataFilesFolder);
      const jsonFiles = files
        .filter((file) => file.startsWith('data') && file.endsWith('.json'))
        .sort()
        .map((file) => `datafiles/${file}`);

      logger.info(`Found ${jsonFiles.length} data files: ${jsonFiles.join(', ')}`);
      return jsonFiles;
    } catch (error) {
      logger.error({ error, dataFilesFolder }, 'Failed to read data files');
      return [];
    }
  }

  /** 開発モード時は専用アイコン（icon-dev.ico）を使用 */
  static getAppIconPath(): string {
    const iconFileName = EnvConfig.isDevelopment ? 'icon-dev.ico' : 'icon.ico';
    const baseDir = EnvConfig.isDevelopment ? process.cwd() : path.join(__dirname, '../..');
    return path.join(baseDir, 'assets', iconFileName);
  }

  static ensureDirectories(): void {
    const dirs = [
      this.getConfigFolder(),
      this.getDataFilesFolder(),
      this.getIconCacheFolder(),
      this.getAppsFolder(),
      this.getSchemesFolder(),
      this.getExtensionsFolder(),
      this.getFaviconsFolder(),
      this.getCustomIconsFolder(),
      this.getBackupFolder(),
      this.getClipboardDataFolder(),
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

  static setConfigFolderForTesting(customPath: string): void {
    this.configFolder = path.resolve(customPath);
    logger.info(`Config folder overridden for testing: ${this.configFolder}`);
  }

  static resetConfigFolder(): void {
    this.configFolder = null;
    logger.info('Config folder override reset');
  }

  private static getDefaultConfigPath(): string {
    return path.join(app.getPath('userData'), 'config');
  }

  private static getIconCacheSubfolder(subfolder: string): string {
    return path.join(this.getIconCacheFolder(), subfolder);
  }

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
