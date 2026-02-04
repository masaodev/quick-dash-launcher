/**
 * 重複検出ユーティリティ
 * ブックマークインポート時に既存アイテムとの重複を検出する
 */

import type { SimpleBookmarkItem, DuplicateCheckResult } from '../types/bookmark';
import type { EditableJsonItem } from '../types/editableItem';

/**
 * URLを正規化する（末尾スラッシュ除去、小文字化、http->https統一）
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim().toLowerCase();

  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  if (normalized.startsWith('http://')) {
    normalized = 'https://' + normalized.slice(7);
  }

  return normalized;
}

/**
 * ブックマークと既存アイテムの重複をチェックする
 * URLが一致すれば重複と判定（正規化して比較）
 */
export function checkDuplicates(
  bookmarks: SimpleBookmarkItem[],
  existingItems: EditableJsonItem[]
): DuplicateCheckResult {
  const existingUrlMap = buildUrlToIdMap(existingItems);

  const duplicateExistingIds: string[] = [];
  const duplicateBookmarkIds: string[] = [];

  for (const bookmark of bookmarks) {
    const normalizedUrl = normalizeUrl(bookmark.url);
    const existingId = existingUrlMap.get(normalizedUrl);

    if (existingId) {
      duplicateExistingIds.push(existingId);
      duplicateBookmarkIds.push(bookmark.id);
    }
  }

  return {
    duplicateCount: duplicateBookmarkIds.length,
    newCount: bookmarks.length - duplicateBookmarkIds.length,
    duplicateExistingIds,
    duplicateBookmarkIds,
  };
}

/**
 * 重複するブックマークをフィルタリングして新規のみを返す
 */
export function filterNonDuplicateBookmarks(
  bookmarks: SimpleBookmarkItem[],
  duplicateBookmarkIds: string[]
): SimpleBookmarkItem[] {
  const duplicateSet = new Set(duplicateBookmarkIds);
  return bookmarks.filter((bookmark) => !duplicateSet.has(bookmark.id));
}

/**
 * 既存アイテムからURL->IDのマッピングを作成する
 */
export function buildUrlToIdMap(existingItems: EditableJsonItem[]): Map<string, string> {
  const urlMap = new Map<string, string>();

  for (const { item } of existingItems) {
    if (item.type === 'item' && item.path) {
      urlMap.set(normalizeUrl(item.path), item.id);
    }
  }

  return urlMap;
}
