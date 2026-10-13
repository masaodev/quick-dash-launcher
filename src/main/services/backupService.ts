import * as fs from 'fs';
import * as path from 'path';

import logger from '@common/logger';
import type { SnapshotInfo, BackupStatus } from '@common/types/backup';
import { FileUtils } from '@common/utils/fileUtils';

import PathManager from '../config/pathManager.js';

import { SettingsService } from './settingsService.js';
import { mainI18n } from './mainI18n.js';

/** 外部変更の変更前スナップショットのフォルダ名サフィックス */
const PRE_EXTERNAL_SUFFIX = '_pre-external';
/**
 * スナップショットのフォルダ名の規則: `<タイムスタンプ>[-<連番>][_<サフィックス>]`
 * （1: タイムスタンプ 2: 同じ秒に作ったときの連番（2 から） 3: `_pre-restore` などのサフィックス）
 */
const SNAPSHOT_NAME_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})(?:-(\d+))?(_.+)?$/;

/** ローカル時刻の日付（1 日 1 回の判定に使う） */
function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** 変更前スナップショットの保持上限（backupRetention とは別枠） */
const PRE_EXTERNAL_SNAPSHOT_LIMIT = 10;

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

    // 1日1回チェック: 直近の通常スナップショットが今日作成済みならスキップ
    // （_pre-restore / _pre-external は部分的・臨時なので数えない）
    const snapshots = (await this.listSnapshots()).filter((s) =>
      this.isRegularSnapshot(s.timestamp)
    );
    if (snapshots.length > 0) {
      if (toLocalDateKey(new Date()) === toLocalDateKey(snapshots[0].createdAt)) {
        logger.info('スナップショットをスキップ: 本日すでに作成済み');
        return false;
      }
    }

    // 変更検知（トリガーファイルのみで判定）
    if (!(await this.hasChanges())) {
      logger.info('スナップショットをスキップ: 変更なし');
      return false;
    }

    const { snapshotFolder, copiedCount } = await this.copyTargetsToSnapshot();

    if (copiedCount === 0) {
      fs.rmSync(snapshotFolder, { recursive: true, force: true });
      logger.warn('スナップショット作成: コピー対象ファイルなし');
      return false;
    }

    logger.info({ snapshotFolder, fileCount: copiedCount }, 'スナップショットを作成しました');

    this.logLegacyBackupFiles(PathManager.getBackupFolder());

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
      const createdOrder = new Map<string, number>();

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
        createdOrder.set(entry.name, this.getFolderBirthtime(folderPath));
      }

      // 新しい順にソート。名前は秒単位なので、同じ秒のものはフォルダの作成時刻、
      // それも同じなら連番の大きい方を新しいとみなす（種類の違うサフィックスをまたいでも並ぶ）
      snapshots.sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          (createdOrder.get(b.timestamp) ?? 0) - (createdOrder.get(a.timestamp) ?? 0) ||
          this.parseSequence(b.timestamp) - this.parseSequence(a.timestamp)
      );
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
    const snapshotFolder = this.resolveSnapshotFolder(timestamp);

    if (!snapshotFolder || !FileUtils.exists(snapshotFolder)) {
      return { success: false, error: mainI18n.t('backupErrors.snapshotNotFound') };
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
      const errorMessage =
        error instanceof Error ? error.message : mainI18n.t('backupErrors.restoreFailed');
      logger.error({ error, timestamp }, 'スナップショットのリストアに失敗');
      return { success: false, error: errorMessage };
    }
  }

  /**
   * スナップショットを削除する
   */
  public async deleteSnapshot(timestamp: string): Promise<{ success: boolean; error?: string }> {
    const snapshotFolder = this.resolveSnapshotFolder(timestamp);

    if (!snapshotFolder || !FileUtils.exists(snapshotFolder)) {
      return { success: false, error: mainI18n.t('backupErrors.snapshotNotFound') };
    }

    try {
      fs.rmSync(snapshotFolder, { recursive: true, force: true });
      logger.info({ timestamp }, 'スナップショットを削除しました');
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : mainI18n.t('backupErrors.deleteFailed');
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
   *
   * _pre-external は cleanupPreExternalSnapshots() が別枠で管理するため数に入れない
   * （数に入れると、外部編集を繰り返したときに日次スナップショットが押し出される）
   */
  private async cleanupOldSnapshots(): Promise<void> {
    if (!this.settingsService) return;

    const backupRetention = await this.settingsService.get('backupRetention');
    const snapshots = (await this.listSnapshots()).filter(
      (s) => !s.timestamp.endsWith(PRE_EXTERNAL_SUFFIX)
    );

    const toDelete = snapshots.slice(backupRetention);
    if (toDelete.length === 0) return;

    const backupFolder = PathManager.getBackupFolder();
    for (const snapshot of toDelete) {
      const snapshotFolder = path.join(backupFolder, snapshot.timestamp);
      try {
        fs.rmSync(snapshotFolder, { recursive: true, force: true });
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
   * 人・AI が編集するファイル: data*.json、settings.json、workspace.json、workspace-archive.json
   * （UI 状態・clipboard は含まない）
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

    for (const sourcePath of [
      path.join(configFolder, 'settings.json'),
      PathManager.getWorkspaceFilePath(),
      PathManager.getWorkspaceArchiveFilePath(),
    ]) {
      targets.push({ sourcePath, relativePath: path.relative(configFolder, sourcePath) });
    }

    return targets;
  }

  /**
   * バックアップ対象ファイル/フォルダの一覧を取得
   * トリガーファイル + UI 状態 + clipboard-data を含む
   */
  private async getBackupTargets(): Promise<Array<{ sourcePath: string; relativePath: string }>> {
    const configFolder = PathManager.getConfigFolder();

    // トリガーファイル（data*.json + settings.json + workspace 2 ファイル）を基盤とする
    const targets = await this.getTriggerTargets();

    // UI 状態（bounds 保存で頻繁に変わるのでトリガーにはしない）。旧形式の detached が残っていれば移行前の退避のために含める
    for (const sourcePath of [
      PathManager.getWorkspaceUiStateFilePath(),
      PathManager.getLegacyWorkspaceDetachedFilePath(),
    ]) {
      if (FileUtils.exists(sourcePath)) {
        targets.push({ sourcePath, relativePath: path.relative(configFolder, sourcePath) });
      }
    }

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
   * 外部変更を検知したときに「変更前の内容」をスナップショットとして残す
   *
   * 検知時点でディスク上は既に変更後なので、トラッカーが記憶していた変更前の内容を
   * 受け取って書き出す。QDL 外（人・AI）の編集で壊れたときの戻し先になる。
   * backupEnabled が false なら何もしない。
   *
   * @param files - 変更前の内容（relativePath は設定フォルダからの相対パス）
   * @returns 作成したスナップショットのフォルダ名。作らなかった場合は null
   */
  public async createPreExternalChangeSnapshot(
    files: Array<{ relativePath: string; content: string }>
  ): Promise<string | null> {
    if (!this.settingsService || files.length === 0) return null;

    const backupEnabled = await this.settingsService.get('backupEnabled');
    if (!backupEnabled) return null;

    const backupFolder = PathManager.getBackupFolder();
    const { timestamp, snapshotFolder } = this.allocateSnapshotFolder(
      backupFolder,
      PRE_EXTERNAL_SUFFIX
    );

    let writtenCount = 0;
    for (const file of files) {
      const destPath = path.join(snapshotFolder, file.relativePath);
      if (FileUtils.safeWriteTextFile(destPath, file.content)) {
        writtenCount++;
      } else {
        logger.error({ relativePath: file.relativePath }, '変更前スナップショットの書き出しに失敗');
      }
    }

    if (writtenCount === 0) {
      fs.rmSync(snapshotFolder, { recursive: true, force: true });
      return null;
    }

    logger.info(
      { snapshotFolder, fileCount: writtenCount },
      '外部変更を検知したため変更前スナップショットを作成しました'
    );
    await this.cleanupPreExternalSnapshots();
    return timestamp;
  }

  /**
   * 変更前スナップショット（_pre-external）だけを上限件数まで間引く
   *
   * 通常の保持件数（backupRetention）で数えると、外部編集を繰り返したときに
   * 日次スナップショットを押し出してしまうため、別枠で管理する。
   */
  private async cleanupPreExternalSnapshots(): Promise<void> {
    const snapshots = await this.listSnapshots();
    const preExternal = snapshots.filter((s) => s.timestamp.endsWith(PRE_EXTERNAL_SUFFIX));
    const toDelete = preExternal.slice(PRE_EXTERNAL_SNAPSHOT_LIMIT);

    const backupFolder = PathManager.getBackupFolder();
    for (const snapshot of toDelete) {
      try {
        fs.rmSync(path.join(backupFolder, snapshot.timestamp), { recursive: true, force: true });
        logger.info({ timestamp: snapshot.timestamp }, '古い変更前スナップショットを削除しました');
      } catch (error) {
        logger.error(
          { error, timestamp: snapshot.timestamp },
          '変更前スナップショットの削除に失敗'
        );
      }
    }
  }

  /**
   * ワークスペースファイルの形式移行前に全対象をスナップショットする（_pre-migration）
   *
   * 不可逆な形式変更なので backupEnabled に関係なく作る。失敗したら呼び出し側は移行しない
   */
  public async createPreMigrationSnapshot(): Promise<void> {
    const snapshotFolder = await this.createForcedSnapshot('pre-migration');

    // 移行元のワークスペースファイルが実際にコピーされたことを確認する（コピー失敗は copy 側で握られるため）
    for (const sourcePath of [
      PathManager.getWorkspaceFilePath(),
      PathManager.getWorkspaceArchiveFilePath(),
      PathManager.getLegacyWorkspaceDetachedFilePath(),
    ]) {
      if (!FileUtils.exists(sourcePath)) continue;
      const copied = path.join(snapshotFolder, path.basename(sourcePath));
      if (!FileUtils.exists(copied)) {
        throw new Error(
          mainI18n.t('backupErrors.preMigrationCopyFailed', { file: path.basename(sourcePath) })
        );
      }
    }
  }

  private async createForcedSnapshot(suffix: string): Promise<string> {
    const { snapshotFolder } = await this.copyTargetsToSnapshot(suffix);
    logger.info({ snapshotFolder, suffix }, '強制スナップショットを作成しました');
    return snapshotFolder;
  }

  private async copyTargetsToSnapshot(
    suffix?: string
  ): Promise<{ snapshotFolder: string; copiedCount: number }> {
    const backupFolder = PathManager.getBackupFolder();
    FileUtils.ensureDirectory(backupFolder);

    const { snapshotFolder } = this.allocateSnapshotFolder(
      backupFolder,
      suffix ? `_${suffix}` : ''
    );

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

    return { snapshotFolder, copiedCount };
  }

  /** フォルダ名に使う UTC の日時（2026-02-11T08-30-00） */
  private createTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  }

  /**
   * スナップショットのフォルダを作る（名前の規則は SNAPSHOT_NAME_PATTERN）。
   * フォルダ名は秒単位なので、同じ秒にもう 1 つ作ると前のものを上書きしてしまう
   * （外部で壊した直後に直して読み込むと、壊れる前の内容が消える）。
   * 同じ名前があれば `<タイムスタンプ>-2<サフィックス>` のように連番を付ける。
   * 確かめてから作るのではなく、再帰なしの mkdir が「既にある」で失敗したら次の番号へ進むので、
   * 同時に作っても同じフォルダを使わない
   */
  private allocateSnapshotFolder(
    backupFolder: string,
    suffix: string
  ): { timestamp: string; snapshotFolder: string } {
    FileUtils.ensureDirectory(backupFolder);
    const base = this.createTimestamp();
    for (let sequence = 1; ; sequence++) {
      const timestamp = `${base}${sequence === 1 ? '' : `-${sequence}`}${suffix}`;
      const snapshotFolder = path.join(backupFolder, timestamp);
      try {
        fs.mkdirSync(snapshotFolder);
        return { timestamp, snapshotFolder };
      } catch (error) {
        if ((error as { code?: string }).code !== 'EEXIST') throw error;
      }
    }
  }

  /** 同じ秒に作ったスナップショットの連番（連番なしは 1） */
  private parseSequence(name: string): number {
    const sequence = SNAPSHOT_NAME_PATTERN.exec(name)?.[2];
    return sequence ? Number(sequence) : 1;
  }

  /** フォルダの作成時刻（取れなければ 0） */
  private getFolderBirthtime(folderPath: string): number {
    try {
      return fs.statSync(folderPath).birthtimeMs;
    } catch {
      return 0;
    }
  }

  private isTimestampFolder(name: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/.test(name);
  }

  /** サフィックスなしの通常（日次）スナップショットか */
  private isRegularSnapshot(name: string): boolean {
    const match = SNAPSHOT_NAME_PATTERN.exec(name);
    return match !== null && match[3] === undefined;
  }

  /**
   * renderer から受け取ったスナップショット名を、バックアップフォルダ直下のパスにする。
   * 名前の規則に合わない・フォルダの外を指す名前（`..` や区切り文字を含む）は null
   */
  private resolveSnapshotFolder(name: string): string | null {
    if (!SNAPSHOT_NAME_PATTERN.test(name) || path.basename(name) !== name || name.includes('..')) {
      return null;
    }
    return path.join(PathManager.getBackupFolder(), name);
  }

  private parseTimestamp(name: string): Date {
    // フォルダ名は createTimestamp が UTC で作る: 2026-02-11T08-30-00 → 2026-02-11T08:30:00Z
    const isoLike = name.substring(0, 19).replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
    return new Date(`${isoLike}Z`);
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
