/**
 * バックアップ（スナップショット）関連の型定義
 */

/** スナップショットの情報 */
export interface SnapshotInfo {
  /** タイムスタンプ文字列（フォルダ名） 例: 2026-02-11T08-30-00 */
  timestamp: string;
  /** 作成日時 */
  createdAt: Date;
  /** 合計サイズ（バイト） */
  totalSize: number;
  /** ファイル数 */
  fileCount: number;
}

/** バックアップ状態（UI表示用） */
export interface BackupStatus {
  /** スナップショット件数 */
  snapshotCount: number;
  /** 最終バックアップ日時（null: バックアップなし） */
  lastBackupTime: Date | null;
  /** 合計サイズ（バイト） */
  totalSize: number;
}
