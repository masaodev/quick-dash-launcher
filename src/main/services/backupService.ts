import * as fs from 'fs';
import * as path from 'path';

import logger from '@common/logger';
import type { SnapshotInfo, BackupStatus } from '@common/types/backup';
import { FileUtils } from '@common/utils/fileUtils';

import PathManager from '../config/pathManager.js';

import { SettingsService } from './settingsService.js';

/**
 * スナップショット方式のバックアップサービス
 *
 * タイムスタンプフォルダごとに全対象ファイルをまとめて保存する。
 * リストア時は「どの時点」を選ぶだけで復元可能。
 */
export class BackupService {
  private static instance: BackupService;
  private settingsService: SettingsService | null = null;

  private constructor() {}

  public static async getInstance(): Promise<BackupService> {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
      BackupService.instance.settingsService = await SettingsService.getInstance();
    }
    return BackupService.instance;
  }

  /**
   * スナップショットを作成する（起動時に1日1回のみ）
   * 設定チェック・1日1回チェック・変更検知を行い、条件を満たす場合のみ作成
   */
  public async createSnapshot(): Promise<boolean> {
    if (!this.settingsService) return false;

    const backupEnabled = await this.settingsService.get('backupEnabled');
    if (!backupEnabled) return false;

    // 1日1回チェック: 直近スナップショットが今日作成済みならスキップ
    const snapshots = await this.listSnapshots();
    if (snapshots.length > 0) {
      const today = new Date().toISOString().substring(0, 10);
      const latestDate = snapshots[0].createdAt.toISOString().substring(0, 10);
      if (today === latestDate) {
        logger.info('スナップショットをスキップ: 本日すでに作成済み');
        return false;
      }
    }

    // 変更検知（トリガーファイルのみで判定）
    if (!(await this.hasChanges())) {
      logger.info('スナップショットをスキップ: 変更なし');
      return false;
    }

    // スナップショット作成
    const backupFolder = PathManager.getBackupFolder();
    FileUtils.ensureDirectory(backupFolder);

    const timestamp = this.createTimestamp();
    const snapshotFolder = path.join(backupFolder, timestamp);
    FileUtils.ensureDirectory(snapshotFolder);

    const targets = await this.getBackupTargets();
    let copiedCount = 0;

    for (const target of targets) {
      if (!FileUtils.exists(target.sourcePath)) continue;

      const destPath = path.join(snapshotFolder, target.relativePath);
      FileUtils.ensureDirectory(path.dirname(destPath));

      if (FileUtils.safeCopyFile(target.sourcePath, destPath)) {
        copiedCount++;
      } else {
        logger.error({ source: target.sourcePath }, 'スナップショットへのファイルコピーに失敗');
      }
    }

    if (copiedCount === 0) {
      // コピーが1つもなければフォルダを削除
      this.removeDirRecursive(snapshotFolder);
      logger.warn('スナップショット作成: コピー対象ファイルなし');
      return false;
    }

    logger.info({ timestamp, fileCount: copiedCount }, 'スナップショットを作成しました');

    // 旧形式ファイルの検出ログ
    this.logLegacyBackupFiles(backupFolder);

    await this.cleanupOldSnapshots();
    return true;
  }

  /**
   * スナップショット一覧を取得
   */
  public async listSnapshots(): Promise<SnapshotInfo[]> {
    const backupFolder = PathManager.getBackupFolder();
    if (!FileUtils.exists(backupFolder)) return [];

    try {
      const entries = fs.readdirSync(backupFolder, { withFileTypes: true });
      const snapshots: SnapshotInfo[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!this.isTimestampFolder(entry.name)) continue;

        const folderPath = path.join(backupFolder, entry.name);
        const { totalSize, fileCount } = this.getFolderStats(folderPath);

        snapshots.push({
          timestamp: entry.name,
          createdAt: this.parseTimestamp(entry.name),
          totalSize,
          fileCount,
        });
      }

      // 新しい順にソート
      snapshots.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return snapshots;
    } catch (error) {
      logger.error({ error }, 'スナップショット一覧の取得に失敗');
      return [];
    }
  }

  /**
   * スナップショットからリストアする
   * リストア前に自動的にバックアップを作成する
   */
  public async restoreSnapshot(timestamp: string): Promise<{ success: boolean; error?: string }> {
    const backupFolder = PathManager.getBackupFolder();
    const snapshotFolder = path.join(backupFolder, timestamp);

    if (!FileUtils.exists(snapshotFolder)) {
      return { success: false, error: 'スナップショットが見つかりません' };
    }

    // リストア前の自動バックアップ（設定に関係なく強制作成）
    try {
      await this.createForcedSnapshot('pre-restore');
    } catch (error) {
      logger.error({ error }, 'リストア前の自動バックアップに失敗');
      // 続行する
    }

    const configFolder = PathManager.getConfigFolder();

    try {
      // スナップショット内の全ファイルを復元
      const files = this.listFilesRecursive(snapshotFolder);

      for (const relPath of files) {
        const sourcePath = path.join(snapshotFolder, relPath);
        const destPath = path.join(configFolder, relPath);

        FileUtils.ensureDirectory(path.dirname(destPath));
        if (!FileUtils.safeCopyFile(sourcePath, destPath)) {
          logger.error({ relPath }, 'リストア中のファイルコピーに失敗');
        }
      }

      logger.info({ timestamp, fileCount: files.length }, 'スナップショットからリストアしました');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'リストアに失敗しました';
      logger.error({ error, timestamp }, 'スナップショットのリストアに失敗');
      return { success: false, error: errorMessage };
    }
  }

  /**
   * スナップショットを削除する
   */
  public async deleteSnapshot(timestamp: string): Promise<{ success: boolean; error?: string }> {
    const backupFolder = PathManager.getBackupFolder();
    const snapshotFolder = path.join(backupFolder, timestamp);

    if (!FileUtils.exists(snapshotFolder)) {
      return { success: false, error: 'スナップショットが見つかりません' };
    }

    try {
      this.removeDirRecursive(snapshotFolder);
      logger.info({ timestamp }, 'スナップショットを削除しました');
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '削除に失敗しました';
      logger.error({ error, timestamp }, 'スナップショットの削除に失敗');
      return { success: false, error: errorMessage };
    }
  }

  /**
   * バックアップ状態を取得（UI表示用）
   */
  public async getStatus(): Promise<BackupStatus> {
    const snapshots = await this.listSnapshots();
    const totalSize = snapshots.reduce((sum, s) => sum + s.totalSize, 0);

    return {
      snapshotCount: snapshots.length,
      lastBackupTime: snapshots.length > 0 ? snapshots[0].createdAt : null,
      totalSize,
    };
  }

  /**
   * 直近スナップショットとの差分検知（トリガーファイルのみで判定）
   * data*.json と settings.json の変更のみをチェックする。
   * workspace.json / workspace-archive.json / clipboard-data/ はスナップショットに含めるが、
   * 変更検知のトリガーには使わない。
   */
  private async hasChanges(): Promise<boolean> {
    const snapshots = await this.listSnapshots();
    if (snapshots.length === 0) return true; // バックアップがなければ変更ありとみなす

    const latestTimestamp = snapshots[0].timestamp;
    const backupFolder = PathManager.getBackupFolder();
    const snapshotFolder = path.join(backupFolder, latestTimestamp);

    const triggerTargets = await this.getTriggerTargets();

    for (const target of triggerTargets) {
      const snapshotPath = path.join(snapshotFolder, target.relativePath);
      const sourceExists = FileUtils.exists(target.sourcePath);
      const snapshotExists = FileUtils.exists(snapshotPath);

      // 片方だけ存在する場合は変更あり
      if (sourceExists !== snapshotExists) return true;

      // 両方存在する場合はバイナリ比較
      if (sourceExists && !FileUtils.areFilesEqual(target.sourcePath, snapshotPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 保持件数超過分の古いスナップショットを削除
   */
  private async cleanupOldSnapshots(): Promise<void> {
    if (!this.settingsService) return;

    const backupRetention = await this.settingsService.get('backupRetention');
    const snapshots = await this.listSnapshots();

    const toDelete = snapshots.slice(backupRetention);
    if (toDelete.length === 0) return;

    const backupFolder = PathManager.getBackupFolder();
    for (const snapshot of toDelete) {
      const snapshotFolder = path.join(backupFolder, snapshot.timestamp);
      try {
        this.removeDirRecursive(snapshotFolder);
        logger.info({ timestamp: snapshot.timestamp }, '古いスナップショットを削除しました');
      } catch (error) {
        logger.error(
          { error, timestamp: snapshot.timestamp },
          'スナップショットのクリーンアップに失敗'
        );
      }
    }
  }

  /**
   * 変更検知のトリガーとなるファイル一覧を取得
   * data*.json と settings.json のみ（workspace系・clipboardは含まない）
   */
  private async getTriggerTargets(): Promise<Array<{ sourcePath: string; relativePath: string }>> {
    const configFolder = PathManager.getConfigFolder();
    const targets: Array<{ sourcePath: string; relativePath: string }> = [];

    // datafiles/data*.json
    const dataFiles = PathManager.getDataFiles();
    for (const relPath of dataFiles) {
      targets.push({
        sourcePath: path.join(configFolder, relPath),
        relativePath: relPath,
      });
    }

    // settings.json
    const settingsPath = path.join(configFolder, 'settings.json');
    targets.push({
      sourcePath: settingsPath,
      relativePath: 'settings.json',
    });

    return targets;
  }

  /**
   * バックアップ対象ファイル/フォルダの一覧を取得
   * トリガーファイル + workspace系 + clipboard-data を含む
   */
  private async getBackupTargets(): Promise<Array<{ sourcePath: string; relativePath: string }>> {
    const configFolder = PathManager.getConfigFolder();

    // トリガーファイル（data*.json + settings.json）を基盤とする
    const targets = await this.getTriggerTargets();

    // workspace.json
    const workspacePath = PathManager.getWorkspaceFilePath();
    targets.push({
      sourcePath: workspacePath,
      relativePath: path.relative(configFolder, workspacePath),
    });

    // workspace-archive.json
    const workspaceArchivePath = path.join(configFolder, 'workspace-archive.json');
    targets.push({
      sourcePath: workspaceArchivePath,
      relativePath: 'workspace-archive.json',
    });

    // clipboard-data/ (任意: backupIncludeClipboard設定時のみ)
    if (this.settingsService) {
      const includeClipboard = await this.settingsService.get('backupIncludeClipboard');
      if (includeClipboard) {
        const clipboardFolder = PathManager.getClipboardDataFolder();
        if (FileUtils.exists(clipboardFolder)) {
          try {
            const clipFiles = fs.readdirSync(clipboardFolder);
            for (const file of clipFiles) {
              if (file.endsWith('.json')) {
                targets.push({
                  sourcePath: path.join(clipboardFolder, file),
                  relativePath: `clipboard-data/${file}`,
                });
              }
            }
          } catch (error) {
            logger.error({ error }, 'クリップボードデータフォルダの読み取りに失敗');
          }
        }
      }
    }

    return targets;
  }

  /**
   * 設定に関係なく強制的にスナップショットを作成する（リストア前の自動バックアップ用）
   */
  private async createForcedSnapshot(suffix: string): Promise<void> {
    const backupFolder = PathManager.getBackupFolder();
    FileUtils.ensureDirectory(backupFolder);

    const timestamp = `${this.createTimestamp()}_${suffix}`;
    const snapshotFolder = path.join(backupFolder, timestamp);
    FileUtils.ensureDirectory(snapshotFolder);

    const targets = await this.getBackupTargets();

    for (const target of targets) {
      if (!FileUtils.exists(target.sourcePath)) continue;

      const destPath = path.join(snapshotFolder, target.relativePath);
      FileUtils.ensureDirectory(path.dirname(destPath));
      FileUtils.safeCopyFile(target.sourcePath, destPath);
    }

    logger.info({ timestamp }, 'リストア前の自動バックアップを作成しました');
  }

  private createTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  }

  private isTimestampFolder(name: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/.test(name);
  }

  private parseTimestamp(name: string): Date {
    // 2026-02-11T08-30-00 → 2026-02-11T08:30:00
    const isoLike = name.substring(0, 19).replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
    return new Date(isoLike);
  }

  /**
   * フォルダ内の合計サイズとファイル数を取得
   */
  private getFolderStats(folderPath: string): { totalSize: number; fileCount: number } {
    let totalSize = 0;
    let fileCount = 0;

    const files = this.listFilesRecursive(folderPath);
    for (const relPath of files) {
      try {
        const stat = fs.statSync(path.join(folderPath, relPath));
        totalSize += stat.size;
        fileCount++;
      } catch {
        // skip
      }
    }

    return { totalSize, fileCount };
  }

  /**
   * フォルダ内の全ファイルを再帰的にリストアップ（相対パスで返す）
   */
  private listFilesRecursive(dir: string, basePath: string = ''): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          results.push(...this.listFilesRecursive(path.join(dir, entry.name), relPath));
        } else {
          results.push(relPath);
        }
      }
    } catch {
      // skip
    }
    return results;
  }

  /**
   * ディレクトリを再帰的に削除
   */
  private removeDirRecursive(dirPath: string): void {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }

  /**
   * 旧形式バックアップファイルの存在をログ出力
   */
  private logLegacyBackupFiles(backupFolder: string): void {
    try {
      const entries = fs.readdirSync(backupFolder);
      const legacyFiles = entries.filter((name) => {
        // 旧形式: data.json.{timestamp} または data_{timestamp}.json
        return (
          /^data.*\.json\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(name) ||
          /^data_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/.test(name)
        );
      });

      if (legacyFiles.length > 0) {
        logger.info(
          { count: legacyFiles.length },
          '旧形式のバックアップファイルが検出されました。これらは新スナップショット方式では管理されません'
        );
      }
    } catch {
      // skip
    }
  }
}
