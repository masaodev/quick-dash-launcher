/**
 * ブックマーク自動取込の結果集計ユーティリティ
 */

import type { BookmarkAutoImportResult } from '../types/bookmarkAutoImport';

export interface BookmarkImportSummary {
  totalImported: number;
  totalDeleted: number;
  hasError: boolean;
  message: string;
}

/**
 * ブックマーク取込結果を集計してサマリを返す
 */
export function summarizeImportResults(results: BookmarkAutoImportResult[]): BookmarkImportSummary {
  const totalImported = results.reduce((sum, r) => sum + r.importedCount, 0);
  const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);
  const hasError = results.some((r) => !r.success);
  const message = `ブックマーク取込: ${totalImported}件登録, ${totalDeleted}件削除${hasError ? ' (一部エラー)' : ''}`;

  return { totalImported, totalDeleted, hasError, message };
}
