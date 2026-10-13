/**
 * ブックマーク自動取込の結果集計ユーティリティ
 */

import type { TFunction } from 'i18next';

import type { BookmarkAutoImportResult } from '../types/bookmarkAutoImport';

export interface BookmarkImportSummary {
  totalImported: number;
  totalDeleted: number;
  /** 手動（ルール外）で登録済みの URL と重なった件数の合計 */
  totalManualDuplicates: number;
  hasError: boolean;
}

/**
 * ブックマーク取込結果を集計してサマリを返す
 */
export function summarizeImportResults(results: BookmarkAutoImportResult[]): BookmarkImportSummary {
  const totalImported = results.reduce((sum, r) => sum + r.importedCount, 0);
  const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
  const totalManualDuplicates = results.reduce((sum, r) => sum + (r.manualDuplicateCount ?? 0), 0);
  const hasError = results.some((r) => !r.success);

  return { totalImported, totalDeleted, totalManualDuplicates, hasError };
}

/**
 * 集計を 1 行の知らせにする（例: ブックマーク取込: 3件登録, 1件削除, 手動分と重複2件）
 */
export function formatImportSummary(summary: BookmarkImportSummary, t: TFunction): string {
  const duplicates =
    summary.totalManualDuplicates > 0
      ? t('bookmarkImport.manualDuplicates', { count: summary.totalManualDuplicates })
      : '';
  const partlyFailed = summary.hasError ? t('bookmarkImport.partlyFailed') : '';
  return (
    t('bookmarkImport.summary', {
      imported: summary.totalImported,
      deleted: summary.totalDeleted,
    }) +
    duplicates +
    partlyFailed
  );
}
