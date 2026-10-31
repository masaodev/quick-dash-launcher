/**
 * バックアップ（スナップショット）関連の型定義
 */

import type { AppDistribution } from './app';

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

/** 一括エクスポートの zip の manifest.json の format（ほかの zip を読み込まないための目印） */
export const DATA_EXPORT_FORMAT = 'quick-dash-launcher-export';

/** 一括エクスポートの zip の形式の版。中の並び・manifest の項目を変えたら上げる */
export const DATA_EXPORT_FORMAT_VERSION = 1;

/** 一括エクスポートの zip の先頭に置く中身の説明（manifest.json） */
export interface DataExportManifest {
  format: typeof DATA_EXPORT_FORMAT;
  formatVersion: number;
  /** 書き出した QDL の版 */
  appVersion: string;
  /** 書き出した QDL の配布形式 */
  distribution: AppDistribution;
  /** 書き出した日時（ISO 8601） */
  exportedAt: string;
  /** 入れたファイル（設定フォルダからの相対パス。区切りは `/`） */
  files: string[];
}

/** 一括エクスポートの結果（保存をやめたときは null を返す） */
export interface DataExportResult {
  filePath: string;
  fileCount: number;
}
