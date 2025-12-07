import * as fs from 'fs';
import * as path from 'path';

import logger from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';

import PathManager from '../config/pathManager.js';

import { SettingsService } from './settingsService.js';

/**
 * バックアップファイルの管理を行うサービスクラス
 * 設定に基づいてバックアップの実行制御と古いファイルの削除を行う
 */
export class BackupService {
  private static instance: BackupService;
  private lastBackupTime: Map<string, number> = new Map();
  private settingsService: SettingsService | null = null;

  private constructor() {}

  /**
   * BackupServiceのシングルトンインスタンスを取得
   */
  public static async getInstance(): Promise<BackupService> {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
      BackupService.instance.settingsService = await SettingsService.getInstance();
    }
    return BackupService.instance;
  }

  /**
   * バックアップを実行すべきかどうか判定
   * @param fileName バックアップ対象のファイル名
   * @param context バックアップのコンテキスト（'start' | 'edit'）
   * @returns バックアップを実行すべきかどうか
   */
  public async shouldBackup(fileName: string, context: 'start' | 'edit'): Promise<boolean> {
    if (!this.settingsService) return false;

    // バックアップが無効な場合
    const backupEnabled = await this.settingsService.get('backupEnabled');
    if (!backupEnabled) return false;

    // コンテキスト別の設定確認
    if (context === 'start') {
      const backupOnStart = await this.settingsService.get('backupOnStart');
      if (!backupOnStart) return false;
    } else if (context === 'edit') {
      const backupOnEdit = await this.settingsService.get('backupOnEdit');
      if (!backupOnEdit) return false;
    }

    // 最小間隔のチェック
    const backupInterval = await this.settingsService.get('backupInterval');
    const lastBackup = this.lastBackupTime.get(fileName) || 0;
    const now = Date.now();
    const intervalMs = backupInterval * 60 * 1000; // 分をミリ秒に変換

    if (now - lastBackup < intervalMs) {
      logger.info({ fileName, backupInterval }, 'バックアップをスキップ: 最小間隔未満');
      return false;
    }

    return true;
  }

  /**
   * 起動時バックアップ用：指定ファイルの最新のバックアップファイルパスを取得
   * @param baseFileName 元のファイル名（拡張子付き）
   * @param backupFolder バックアップフォルダのパス
   * @returns 最新のバックアップファイルパス、存在しない場合はnull
   */
  private getLatestStartupBackupFile(baseFileName: string, backupFolder: string): string | null {
    if (!FileUtils.exists(backupFolder)) {
      return null;
    }

    try {
      const files = fs
        .readdirSync(backupFolder)
        .filter((file) => {
          // 起動時バックアップのファイル名パターン: fileName.timestamp
          const pattern = new RegExp(
            `^${baseFileName}\\.\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}$`
          );
          return pattern.test(file);
        })
        .map((file) => ({
          name: file,
          path: path.join(backupFolder, file),
          mtime: fs.statSync(path.join(backupFolder, file)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime); // 新しい順にソート

      return files.length > 0 ? files[0].path : null;
    } catch (error) {
      logger.error({ error, baseFileName }, '起動時バックアップファイルの検索に失敗しました');
      return null;
    }
  }

  /**
   * 指定ファイルの最新のバックアップファイルパスを取得
   * @param baseFileName 元のファイル名（拡張子付き）
   * @param backupFolder バックアップフォルダのパス
   * @returns 最新のバックアップファイルパス、存在しない場合はnull
   */
  private getLatestBackupFile(baseFileName: string, backupFolder: string): string | null {
    if (!FileUtils.exists(backupFolder)) {
      return null;
    }

    const baseName = path.parse(baseFileName).name;
    const extension = path.parse(baseFileName).ext;

    try {
      const files = fs
        .readdirSync(backupFolder)
        .filter((file) => {
          // ファイル名のパターンマッチング: baseName_timestamp.ext
          const pattern = new RegExp(
            `^${baseName}_\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}${extension}$`
          );
          return pattern.test(file);
        })
        .map((file) => ({
          name: file,
          path: path.join(backupFolder, file),
          mtime: fs.statSync(path.join(backupFolder, file)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime); // 新しい順にソート

      return files.length > 0 ? files[0].path : null;
    } catch (error) {
      logger.error({ error, baseFileName }, 'バックアップファイルの検索に失敗しました');
      return null;
    }
  }

  /**
   * バックアップを実行
   * @param sourcePath バックアップ元ファイルのパス
   * @param backupFolder バックアップ先フォルダ
   * @returns バックアップが実行されたかどうか
   */
  public async createBackup(
    sourcePath: string,
    backupFolder: string = PathManager.getBackupFolder()
  ): Promise<boolean> {
    const fileName = path.basename(sourcePath);
    const context = 'edit'; // デフォルトは編集時として扱う

    if (!(await this.shouldBackup(fileName, context))) {
      return false;
    }

    if (!FileUtils.exists(sourcePath)) {
      logger.warn({ sourcePath }, 'バックアップ元ファイルが存在しません');
      return false;
    }

    FileUtils.ensureDirectory(backupFolder);

    // 直近のバックアップファイルと内容を比較
    const latestBackupPath = this.getLatestBackupFile(fileName, backupFolder);
    if (latestBackupPath && FileUtils.areFilesEqual(sourcePath, latestBackupPath)) {
      logger.info(
        { sourcePath, latestBackupPath },
        'ファイル内容が直近のバックアップと同一のため、バックアップをスキップしました'
      );
      return false;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupFileName = `${path.parse(fileName).name}_${timestamp}${path.parse(fileName).ext}`;
    const backupPath = path.join(backupFolder, backupFileName);

    if (FileUtils.safeCopyFile(sourcePath, backupPath)) {
      this.lastBackupTime.set(fileName, Date.now());
      logger.info({ sourcePath, backupPath }, 'バックアップを作成しました');

      // 古いバックアップの削除
      await this.cleanupOldBackups(fileName, backupFolder);

      return true;
    } else {
      logger.error({ sourcePath }, 'バックアップの作成に失敗しました');
      return false;
    }
  }

  /**
   * 起動時のバックアップ（複数ファイル）
   * @param configFolder 設定フォルダのパス
   */
  public async backupDataFiles(configFolder: string): Promise<void> {
    if (!this.settingsService) return;

    const backupEnabled = await this.settingsService.get('backupEnabled');
    const backupOnStart = await this.settingsService.get('backupOnStart');

    if (!backupEnabled || !backupOnStart) {
      logger.info('起動時バックアップはスキップされました');
      return;
    }

    // 動的にdata*.txtファイルを取得
    const files = PathManager.getDataFiles();
    const backupFolder = path.join(configFolder, 'backup');

    for (const file of files) {
      const sourcePath = path.join(configFolder, file);
      if (FileUtils.exists(sourcePath)) {
        // 直近のバックアップファイルと内容を比較
        const latestBackupPath = this.getLatestStartupBackupFile(file, backupFolder);
        if (latestBackupPath && FileUtils.areFilesEqual(sourcePath, latestBackupPath)) {
          logger.info(
            { file, sourcePath, latestBackupPath },
            'ファイル内容が直近の起動時バックアップと同一のため、バックアップをスキップしました'
          );
          continue;
        }

        const timestamp = new Date().toISOString().replace(/:/g, '-').substring(0, 19);
        const backupPath = path.join(backupFolder, `${file}.${timestamp}`);

        FileUtils.ensureDirectory(backupFolder);
        if (FileUtils.safeCopyFile(sourcePath, backupPath)) {
          this.lastBackupTime.set(file, Date.now());
          logger.info({ file, backupPath }, '起動時バックアップを作成しました');

          // 古いバックアップの削除
          await this.cleanupOldBackups(file, backupFolder);
        } else {
          logger.error({ file }, '起動時バックアップの作成に失敗しました');
        }
      }
    }
  }

  /**
   * 古いバックアップファイルを削除
   * @param baseFileName 元のファイル名（拡張子付き）
   * @param backupFolder バックアップフォルダのパス
   */
  private async cleanupOldBackups(baseFileName: string, backupFolder: string): Promise<void> {
    if (!this.settingsService) return;

    const backupRetention = await this.settingsService.get('backupRetention');
    const baseName = path.parse(baseFileName).name;
    const extension = path.parse(baseFileName).ext;

    try {
      // バックアップファイルを取得
      const files = fs
        .readdirSync(backupFolder)
        .filter((file) => {
          // ファイル名のパターンマッチング: baseName_timestamp.ext
          const pattern = new RegExp(
            `^${baseName}_\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}${extension}$`
          );
          return pattern.test(file);
        })
        .map((file) => ({
          name: file,
          path: path.join(backupFolder, file),
          mtime: fs.statSync(path.join(backupFolder, file)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime); // 新しい順にソート

      // 保持件数を超えるファイルを削除
      if (files.length > backupRetention) {
        const filesToDelete = files.slice(backupRetention);
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          logger.info({ file: file.name }, '古いバックアップファイルを削除しました');
        }
      }
    } catch (error) {
      logger.error({ error, baseFileName }, 'バックアップファイルのクリーンアップに失敗しました');
    }
  }
}
