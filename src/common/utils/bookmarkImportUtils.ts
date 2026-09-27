/**
 * ブックマーク自動取込の結果集計ユーティリティ
 */

import type { BookmarkAutoImportResult } from '../types/bookmarkAutoImport';

export interface BookmarkImportSummary {
  totalImported: number;
  totalDeleted: number;
  /** 手動（ルール外）で登録済みの URL と重なった件数の合計 */
  totalManualDuplicates: number;
  hasError: boolean;
  message: string;
}

/**
 * ブックマーク取込結果を集計してサマリを返す
 */
export function summarizeImportResults(results: BookmarkAutoImportResult[]): BookmarkImportSummary {
  const totalImported = results.reduce((sum, r) => sum + r.importedCount, 0);
  const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
  const totalManualDuplicates = results.reduce((sum, r) => sum + (r.manualDuplicateCount ?? 0), 0);
  const hasError = results.some((r) => !r.success);
  const duplicates = totalManualDuplicates > 0 ? `, 手動分と重複${totalManualDuplicates}件` : '';
  const message = `ブックマーク取込: ${totalImported}件登録, ${totalDeleted}件削除${duplicates}${hasError ? ' (一部エラー)' : ''}`;

  return { totalImported, totalDeleted, totalManualDuplicates, hasError, message };
}
