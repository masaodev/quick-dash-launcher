import { AppItem, SearchMode, WindowInfo } from '@common/types';

/**
 * クエリ文字列をキーワード配列に分割する
 */
function parseKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 0);
}

/**
 * アイテムから検索対象テキストを取得する
 * WindowInfo は title、それ以外は displayName を使用
 */
function getSearchText(item: AppItem): string {
  if ('hwnd' in item) {
    return (item as WindowInfo).title;
  }
  return (item as { displayName: string }).displayName;
}

/**
 * アイテムをクエリでフィルタリングする
 * 複数キーワードのAND検索に対応
 */
export function filterItems(
  items: AppItem[],
  query: string,
  mode: SearchMode = 'normal'
): AppItem[] {
  // ウィンドウモードの場合は先頭の '<' を除去
  const normalizedQuery = mode === 'window' && query.startsWith('<') ? query.substring(1) : query;

  if (!normalizedQuery) {
    return items;
  }

  const keywords = parseKeywords(normalizedQuery);

  return items.filter((item) => {
    const text = getSearchText(item).toLowerCase();
    return keywords.every((keyword) => text.includes(keyword));
  });
}
