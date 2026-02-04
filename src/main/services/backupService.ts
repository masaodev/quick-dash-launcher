import * as fs from 'fs';
import * as path from 'path';

import logger from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';

import PathManager from '../config/pathManager.js';

import { SettingsService } from './settingsService.js';

/**
 * バックアップファイルの管理を行うサービスクラス
 */
export class BackupService {
  private static instance: BackupService;
  private lastBackupTime: Map<string, number> = new Map();
  private settingsService: SettingsService | null = null;

  private constructor() {}

  public static async getInstance(): Promise<BackupService> {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
      BackupService.instance.settingsService = await SettingsService.getInstance();
    }
    return BackupService.instance;
  }

  public async shouldBackup(fileName: string, context: 'start' | 'edit'): Promise<boolean> {
    if (!this.settingsService) return false;

    const backupEnabled = await this.settingsService.get('backupEnabled');
    if (!backupEnabled) return false;

    const contextSetting = context === 'start' ? 'backupOnStart' : 'backupOnEdit';
    const contextEnabled = await this.settingsService.get(contextSetting);
    if (!contextEnabled) return false;

    const backupInterval = await this.settingsService.get('backupInterval');
    const lastBackup = this.lastBackupTime.get(fileName) || 0;
    const intervalMs = backupInterval * 60 * 1000;

    if (Date.now() - lastBackup < intervalMs) {
      logger.info({ fileName, backupInterval }, 'バックアップをスキップ: 最小間隔未満');
      return false;
    }

    return true;
  }

  /** 起動時: fileName.timestamp / 編集時: baseName_timestamp.ext */
  private getBackupFilePattern(baseFileName: string, isStartupBackup: boolean): RegExp {
    if (isStartupBackup) {
      return new RegExp(`^${baseFileName}\\.\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}$`);
    }
    const { name, ext } = path.parse(baseFileName);
    return new RegExp(`^${name}_\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}${ext}$`);
  }

  private getBackupFiles(
    backupFolder: string,
    pattern: RegExp
  ): Array<{ name: string; path: string; mtime: number }> {
    return fs
      .readdirSync(backupFolder)
      .filter((file) => pattern.test(file))
      .map((file) => {
        const filePath = path.join(backupFolder, file);
        return { name: file, path: filePath, mtime: fs.statSync(filePath).mtime.getTime() };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  private getLatestBackupFile(
    baseFileName: string,
    backupFolder: string,
    isStartupBackup: boolean = false
  ): string | null {
    if (!FileUtils.exists(backupFolder)) return null;

    try {
      const pattern = this.getBackupFilePattern(baseFileName, isStartupBackup);
      const files = this.getBackupFiles(backupFolder, pattern);
      return files[0]?.path ?? null;
    } catch (error) {
      logger.error({ error, baseFileName }, 'バックアップファイルの検索に失敗しました');
      return null;
    }
  }

  public async createBackup(
    sourcePath: string,
    backupFolder: string = PathManager.getBackupFolder()
  ): Promise<boolean> {
    const fileName = path.basename(sourcePath);

    if (!(await this.shouldBackup(fileName, 'edit'))) return false;

    if (!FileUtils.exists(sourcePath)) {
      logger.warn({ sourcePath }, 'バックアップ元ファイルが存在しません');
      return false;
    }

    FileUtils.ensureDirectory(backupFolder);

    if (this.isContentUnchanged(sourcePath, fileName, backupFolder, false)) return false;

    const { name, ext } = path.parse(fileName);
    const timestamp = this.createTimestamp();
    const backupPath = path.join(backupFolder, `${name}_${timestamp}${ext}`);

    if (!FileUtils.safeCopyFile(sourcePath, backupPath)) {
      logger.error({ sourcePath }, 'バックアップの作成に失敗しました');
      return false;
    }

    this.lastBackupTime.set(fileName, Date.now());
    logger.info({ sourcePath, backupPath }, 'バックアップを作成しました');
    await this.cleanupOldBackups(fileName, backupFolder);
    return true;
  }

  public async backupDataFiles(configFolder: string): Promise<void> {
    if (!this.settingsService) return;

    const backupEnabled = await this.settingsService.get('backupEnabled');
    const backupOnStart = await this.settingsService.get('backupOnStart');

    if (!backupEnabled || !backupOnStart) {
      logger.info('起動時バックアップはスキップされました');
      return;
    }

    const files = PathManager.getDataFiles();
    const backupFolder = path.join(configFolder, 'backup');
    FileUtils.ensureDirectory(backupFolder);

    for (const file of files) {
      const sourcePath = path.join(configFolder, file);
      if (!FileUtils.exists(sourcePath)) continue;

      if (this.isContentUnchanged(sourcePath, file, backupFolder, true)) continue;

      const timestamp = this.createTimestamp();
      const backupPath = path.join(backupFolder, `${file}.${timestamp}`);

      if (FileUtils.safeCopyFile(sourcePath, backupPath)) {
        this.lastBackupTime.set(file, Date.now());
        logger.info({ file, backupPath }, '起動時バックアップを作成しました');
        await this.cleanupOldBackups(file, backupFolder);
      } else {
        logger.error({ file }, '起動時バックアップの作成に失敗しました');
      }
    }
  }

  private async cleanupOldBackups(baseFileName: string, backupFolder: string): Promise<void> {
    if (!this.settingsService) return;

    const backupRetention = await this.settingsService.get('backupRetention');

    try {
      const pattern = this.getBackupFilePattern(baseFileName, false);
      const files = this.getBackupFiles(backupFolder, pattern);
      const filesToDelete = files.slice(backupRetention);

      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        logger.info({ file: file.name }, '古いバックアップファイルを削除しました');
      }
    } catch (error) {
      logger.error({ error, baseFileName }, 'バックアップファイルのクリーンアップに失敗しました');
    }
  }

  private createTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  }

  private isContentUnchanged(
    sourcePath: string,
    fileName: string,
    backupFolder: string,
    isStartupBackup: boolean
  ): boolean {
    const latestBackupPath = this.getLatestBackupFile(fileName, backupFolder, isStartupBackup);
    if (latestBackupPath && FileUtils.areFilesEqual(sourcePath, latestBackupPath)) {
      logger.info(
        { sourcePath, latestBackupPath },
        'ファイル内容が直近のバックアップと同一のため、バックアップをスキップしました'
      );
      return true;
    }
    return false;
  }
}
