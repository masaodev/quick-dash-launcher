import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';

import type { BookmarkAutoImportResult } from '../types/bookmarkAutoImport';

import {
  formatImportCounts,
  importResultCounts,
  summarizeImportResults,
} from './bookmarkImportUtils';

// キーと件数だけを返す t（文言は辞書側の責務なので、ここでは組み立て方を見る）
const t = ((key: string, options?: { count?: number }) => {
  if (key === 'common.listSeparator') return '/';
  return options?.count === undefined ? key : `${key}:${options.count}`;
}) as unknown as TFunction;

function result(overrides: Partial<BookmarkAutoImportResult>): BookmarkAutoImportResult {
  return { success: true, importedCount: 0, deletedCount: 0, executedAt: 0, ...overrides };
}

describe('formatImportCounts', () => {
  it('0 件の区分は省いて並べる', () => {
    expect(formatImportCounts({ added: 3, updated: 0, deleted: 2 }, t)).toBe(
      'bookmarkImport.countAdded:3/bookmarkImport.countDeleted:2'
    );
  });

  it('どれも 0 なら「変更なし」', () => {
    expect(formatImportCounts({ added: 0, updated: 0, deleted: 0 }, t)).toBe(
      'bookmarkImport.noChange'
    );
  });
});

describe('importResultCounts', () => {
  it('前の版の結果（追加・更新なし）は取り込んだ件数を追加とみなす', () => {
    expect(importResultCounts(result({ importedCount: 5, deletedCount: 5 }))).toEqual({
      added: 5,
      updated: 0,
      deleted: 5,
    });
  });
});

describe('summarizeImportResults', () => {
  it('ルールごとの件数を足し、失敗があれば hasError', () => {
    const summary = summarizeImportResults([
      result({ importedCount: 10, addedCount: 1, updatedCount: 2, deletedCount: 3 }),
      result({ importedCount: 4, addedCount: 4, updatedCount: 0, manualDuplicateCount: 1 }),
      result({ success: false }),
    ]);
    expect(summary).toEqual({
      added: 5,
      updated: 2,
      deleted: 3,
      totalManualDuplicates: 1,
      hasError: true,
    });
  });
});
