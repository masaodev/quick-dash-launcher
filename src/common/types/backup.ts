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

/** 読み込めなかった理由（画面の文言は renderer が選ぶ） */
export type DataImportProblem =
  /** zip でない・QDL が書き出したものでない */
  | { kind: 'notExport' }
  /** 新しい版の QDL で書き出したもの（この QDL では読めない） */
  | { kind: 'newerVersion' }
  /** 中のファイルが読めない・決まった名前でない・大きすぎる */
  | { kind: 'invalidFile'; file: string };

/** 読み込みの確認に出す、書き出したデータの説明と件数（今 → 読み込んだ後） */
export interface DataImportSummary {
  exportedAt: string;
  appVersion: string;
  distribution: AppDistribution;
  fileCount: number;
  items: { before: number; after: number };
  workspaceItems: { before: number; after: number };
}

/** 書き出したファイルを確かめた結果（ファイルを選ぶのをやめたときは null を返す） */
export type DataImportInspectResult =
  | { ok: true; token: string; filePath: string; summary: DataImportSummary }
  | { ok: false; filePath: string; problem: DataImportProblem };

/** 読み込みの結果（成功したら QDL を再起動するので、普通は返らない） */
export type DataImportApplyResult = { success: true } | { success: false; error: string };
