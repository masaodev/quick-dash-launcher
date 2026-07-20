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
 * 小文字化済み検索テキストのキャッシュ。
 * キー入力ごとの全アイテム再小文字化を避ける。アイテムはデータ再読込で
 * 作り直されるため、WeakMapで古いオブジェクトごと自動解放される。
 */
const lowerSearchTextCache = new WeakMap<AppItem, string>();

function getLowerSearchText(item: AppItem): string {
  let text = lowerSearchTextCache.get(item);
  if (text === undefined) {
    text = getSearchText(item).toLowerCase();
    lowerSearchTextCache.set(item, text);
  }
  return text;
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
    const text = getLowerSearchText(item);
    return keywords.every((keyword) => text.includes(keyword));
  });
}
