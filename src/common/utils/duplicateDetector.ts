/**
 * 重複検出ユーティリティ
 *
 * ブックマークインポート時に既存アイテムとの重複を検出するためのユーティリティ関数
 */

import type { SimpleBookmarkItem, DuplicateCheckResult } from '../types/bookmark';
import type { EditableJsonItem } from '../types/editableItem';

/**
 * URLを正規化する
 * - 末尾のスラッシュを除去
 * - 小文字に変換
 * - プロトコル（http:// または https://）を統一（https://に正規化）
 *
 * @param url 正規化するURL
 * @returns 正規化されたURL
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim().toLowerCase();

  // 末尾のスラッシュを除去
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  // http:// を https:// に正規化（比較用）
  if (normalized.startsWith('http://')) {
    normalized = 'https://' + normalized.slice(7);
  }

  return normalized;
}

/**
 * ブックマークと既存アイテムの重複をチェックする
 *
 * 判定基準:
 * - URLが一致（大文字小文字無視、末尾スラッシュ正規化、http/https正規化）
 * - 名前が異なっていてもURLが同じなら重複と判定
 *
 * @param bookmarks チェック対象のブックマーク一覧
 * @param existingItems 既存のアイテム一覧
 * @returns 重複チェック結果
 */
export function checkDuplicates(
  bookmarks: SimpleBookmarkItem[],
  existingItems: EditableJsonItem[]
): DuplicateCheckResult {
  // 既存アイテムのURLを正規化してMapに格納（URL -> アイテムID）
  const existingUrlMap = new Map<string, string>();

  for (const editableItem of existingItems) {
    const item = editableItem.item;
    // itemタイプでpathがURLのものだけを対象にする
    if (item.type === 'item' && item.path) {
      const normalizedUrl = normalizeUrl(item.path);
      existingUrlMap.set(normalizedUrl, item.id);
    }
  }

  const duplicateExistingIds: string[] = [];
  const duplicateBookmarkIds: string[] = [];
  let duplicateCount = 0;
  let newCount = 0;

  for (const bookmark of bookmarks) {
    const normalizedUrl = normalizeUrl(bookmark.url);
    const existingId = existingUrlMap.get(normalizedUrl);

    if (existingId) {
      duplicateCount++;
      duplicateExistingIds.push(existingId);
      duplicateBookmarkIds.push(bookmark.id);
    } else {
      newCount++;
    }
  }

  return {
    duplicateCount,
    newCount,
    duplicateExistingIds,
    duplicateBookmarkIds,
  };
}

/**
 * 重複するブックマークをフィルタリングして新規のみを返す
 *
 * @param bookmarks ブックマーク一覧
 * @param duplicateBookmarkIds 重複しているブックマークのID一覧
 * @returns 重複を除いたブックマーク一覧
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
 *
 * @param existingItems 既存のアイテム一覧
 * @returns 正規化されたURL -> アイテムIDのMap
 */
export function buildUrlToIdMap(existingItems: EditableJsonItem[]): Map<string, string> {
  const urlMap = new Map<string, string>();

  for (const editableItem of existingItems) {
    const item = editableItem.item;
    if (item.type === 'item' && item.path) {
      const normalizedUrl = normalizeUrl(item.path);
      urlMap.set(normalizedUrl, item.id);
    }
  }

  return urlMap;
}
