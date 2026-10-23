/**
 * ブックマーク自動取込の結果集計ユーティリティ
 */

import type { TFunction } from 'i18next';

import type { BookmarkAutoImportResult } from '../types/bookmarkAutoImport';

import type { BookmarkSyncCounts } from './bookmarkRuleSync';

export interface BookmarkImportSummary extends BookmarkSyncCounts {
  /** 手動（ルール外）で登録済みの URL と重なった件数の合計 */
  totalManualDuplicates: number;
  hasError: boolean;
}

/**
 * 1 件の結果の追加・更新・削除の件数。
 * 差分で取り込むようになる前の版が保存した結果には追加・更新が無いので、取り込んだ件数を追加とみなす
 */
export function importResultCounts(result: BookmarkAutoImportResult): BookmarkSyncCounts {
  return {
    added: result.addedCount ?? result.importedCount,
    updated: result.updatedCount ?? 0,
    deleted: result.deletedCount,
  };
}

/**
 * ブックマーク取込結果を集計してサマリを返す
 */
export function summarizeImportResults(results: BookmarkAutoImportResult[]): BookmarkImportSummary {
  const summary: BookmarkImportSummary = {
    added: 0,
    updated: 0,
    deleted: 0,
    totalManualDuplicates: 0,
    hasError: false,
  };
  for (const result of results) {
    const counts = importResultCounts(result);
    summary.added += counts.added;
    summary.updated += counts.updated;
    summary.deleted += counts.deleted;
    summary.totalManualDuplicates += result.manualDuplicateCount ?? 0;
    if (!result.success) summary.hasError = true;
  }
  return summary;
}

/** 追加・更新・削除のどれかがあったか */
export function hasImportChanges(counts: BookmarkSyncCounts): boolean {
  return counts.added > 0 || counts.updated > 0 || counts.deleted > 0;
}

/**
 * 件数を「3 件追加、1 件更新、2 件削除」の形にする。0 件の区分は省き、どれも 0 なら「変更なし」
 */
export function formatImportCounts(counts: BookmarkSyncCounts, t: TFunction): string {
  if (!hasImportChanges(counts)) return t('bookmarkImport.noChange');
  const parts: string[] = [];
  if (counts.added > 0) parts.push(t('bookmarkImport.countAdded', { count: counts.added }));
  if (counts.updated > 0) parts.push(t('bookmarkImport.countUpdated', { count: counts.updated }));
  if (counts.deleted > 0) parts.push(t('bookmarkImport.countDeleted', { count: counts.deleted }));
  return parts.join(t('common.listSeparator'));
}

/**
 * 集計を 1 行の知らせにする（例: ブックマーク取込: 3 件追加、1 件削除、手動分と重複 2 件）
 */
export function formatImportSummary(summary: BookmarkImportSummary, t: TFunction): string {
  const message = t('bookmarkImport.summary', { counts: formatImportCounts(summary, t) });
  return withImportNotes(message, summary.totalManualDuplicates, summary.hasError, t);
}

/**
 * 手動分との重複と一部エラーを、訳文の語順を保ったまま文に添える
 */
export function withImportNotes(
  message: string,
  manualDuplicates: number,
  hasError: boolean,
  t: TFunction
): string {
  const withDuplicates =
    manualDuplicates > 0
      ? t('bookmarkImport.withManualDuplicates', { message, count: manualDuplicates })
      : message;
  return hasError
    ? t('bookmarkImport.withPartlyFailed', { message: withDuplicates })
    : withDuplicates;
}
