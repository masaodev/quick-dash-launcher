import { AppItem } from '../../common/types';

/**
 * アイテムをクエリでフィルタリングする
 * 複数キーワードのAND検索に対応
 *
 * @param items - フィルタリング対象のアイテム配列
 * @param query - 検索クエリ（スペース区切りで複数キーワード指定可能）
 * @returns フィルタリングされたアイテム配列
 */
export function filterItems(items: AppItem[], query: string): AppItem[] {
  if (!query) {
    return items;
  }

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 0);

  return items.filter((item) => {
    const itemText = item.name.toLowerCase();
    return keywords.every((keyword) => itemText.includes(keyword));
  });
}
