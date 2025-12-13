import * as path from 'path';
import * as fs from 'fs';

import { app } from 'electron';

import logger from '../../common/logger.js';

/**
 * アプリケーションの設定ファイル・ディレクトリのパスを管理するクラス
 *
 * 環境変数 QUICK_DASH_CONFIG_DIR を使用してカスタムパスを指定可能
 * テスト時には setConfigFolderForTesting() でパスをオーバーライド可能
 */
export class PathManager {
  private static configFolder: string | null = null;

  /**
   * 設定フォルダのベースパスを取得
   * @returns 設定フォルダの絶対パス
   */
  static getConfigFolder(): string {
    // テスト用のオーバーライドが設定されている場合
    if (this.configFolder) {
      return this.configFolder;
    }

    // 環境変数でカスタムパスが指定されている場合
    if (process.env.QUICK_DASH_CONFIG_DIR) {
      const customPath = path.resolve(process.env.QUICK_DASH_CONFIG_DIR);

      // セキュリティチェック: 危険なパスを拒否
      if (this.isUnsafePath(customPath)) {
        logger.warn(`Unsafe config path detected: ${customPath}. Using default path instead.`);
        return path.join(app.getPath('userData'), 'config');
      }

      logger.info(`Using custom config path: ${customPath}`);
      return customPath;
    }

    // デフォルトパス（後方互換性のため）
    return path.join(app.getPath('userData'), 'config');
  }

  /**
   * アイコンフォルダのパスを取得
   * @returns アイコンフォルダの絶対パス
   */
  static getIconsFolder(): string {
    return path.join(this.getConfigFolder(), 'icons');
  }

  /**
   * faviconフォルダのパスを取得
   * @returns faviconフォルダの絶対パス
   */
  static getFaviconsFolder(): string {
    return path.join(this.getConfigFolder(), 'favicons');
  }

  /**
   * カスタムアイコンフォルダのパスを取得
   * @returns カスタムアイコンフォルダの絶対パス
   */
  static getCustomIconsFolder(): string {
    return path.join(this.getConfigFolder(), 'custom-icons');
  }

  /**
   * スキームアイコンフォルダのパスを取得
   * @returns スキームアイコンフォルダの絶対パス
   */
  static getSchemesFolder(): string {
    return path.join(this.getIconsFolder(), 'schemes');
  }

  /**
   * 拡張子アイコンフォルダのパスを取得
   * @returns 拡張子アイコンフォルダの絶対パス
   */
  static getExtensionsFolder(): string {
    return path.join(this.getIconsFolder(), 'extensions');
  }

  /**
   * バックアップフォルダのパスを取得
   * @returns バックアップフォルダの絶対パス
   */
  static getBackupFolder(): string {
    return path.join(this.getConfigFolder(), 'backup');
  }

  /**
   * data.txtファイルのパスを取得
   * @returns data.txtファイルの絶対パス
   */
  static getDataFilePath(): string {
    return path.join(this.getConfigFolder(), 'data.txt');
  }

  /**
   * workspace.jsonファイルのパスを取得
   * @returns workspace.jsonファイルの絶対パス
   */
  static getWorkspaceFilePath(): string {
    return path.join(this.getConfigFolder(), 'workspace.json');
  }

  /**
   * 設定フォルダ内のすべてのdata*.txtファイルを取得
   * @returns データファイル名の配列（例: ['data.txt', 'data2.txt', 'data3.txt']）
   */
  static getDataFiles(): string[] {
    const configFolder = this.getConfigFolder();

    try {
      if (!fs.existsSync(configFolder)) {
        logger.warn(`Config folder does not exist: ${configFolder}`);
        return [];
      }

      // 設定フォルダ内のファイル一覧を取得
      const files = fs.readdirSync(configFolder);

      // data*.txt パターンにマッチするファイルをフィルタリング
      const dataFiles = files
        .filter((file) => {
          // data で始まり .txt で終わるファイル
          return file.startsWith('data') && file.endsWith('.txt');
        })
        .sort(); // ファイル名順にソート

      logger.info(`Found ${dataFiles.length} data files: ${dataFiles.join(', ')}`);
      return dataFiles;
    } catch (error) {
      logger.error({ error, configFolder }, 'Failed to read data files');
      return [];
    }
  }

  /**
   * 必要なディレクトリを作成
   */
  static ensureDirectories(): void {
    const dirs = [
      this.getConfigFolder(),
      this.getIconsFolder(),
      this.getFaviconsFolder(),
      this.getCustomIconsFolder(),
      this.getSchemesFolder(),
      this.getExtensionsFolder(),
      this.getBackupFolder(),
    ];

    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          logger.info(`Created directory: ${dir}`);
        } catch (error) {
          logger.error({ error, dir }, 'Failed to create directory');
          throw error;
        }
      }
    });
  }

  /**
   * テスト用に設定フォルダをオーバーライド
   * @param customPath カスタム設定フォルダのパス
   */
  static setConfigFolderForTesting(customPath: string): void {
    this.configFolder = path.resolve(customPath);
    logger.info(`Config folder overridden for testing: ${this.configFolder}`);
  }

  /**
   * 設定フォルダのオーバーライドをリセット
   */
  static resetConfigFolder(): void {
    this.configFolder = null;
    logger.info('Config folder override reset');
  }

  /**
   * 危険なパスかどうかをチェック
   * @param targetPath チェック対象のパス
   * @returns 危険なパスの場合true
   */
  private static isUnsafePath(targetPath: string): boolean {
    // システムディレクトリやルートディレクトリへの書き込みを防ぐ
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

    // 危険なパスまたはその子ディレクトリかチェック
    return unsafePaths.some((unsafePath) => {
      const normalizedUnsafe = path.normalize(unsafePath).toLowerCase();
      return (
        normalizedPath === normalizedUnsafe ||
        normalizedPath.startsWith(normalizedUnsafe + path.sep)
      );
    });
  }

  /**
   * 設定フォルダが書き込み可能かチェック
   * @returns 書き込み可能な場合true
   */
  static isConfigFolderWritable(): boolean {
    const configFolder = this.getConfigFolder();

    try {
      // ディレクトリが存在しない場合は作成を試みる
      if (!fs.existsSync(configFolder)) {
        fs.mkdirSync(configFolder, { recursive: true });
      }

      // 書き込みテスト
      const testFile = path.join(configFolder, '.write-test');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      return true;
    } catch (error) {
      logger.error({ error, configFolder }, 'Config folder is not writable');
      return false;
    }
  }
}

export default PathManager;
