import { AppItem, SearchMode, WindowInfo } from '@common/types';

/**
 * クエリ文字列をキーワード配列に分割する
 */
export function parseKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 0);
}

/** 設定「検索でメモにも当てる」（searchMemo）。メインウィンドウが設定を読んで入れる */
let includeMemo = false;

/** 検索でメモにも当てるかを切り替える（設定の読み込み・変更のたびに呼ぶ） */
export function setSearchMemo(enabled: boolean): void {
  includeMemo = enabled;
}

/**
 * アイテムから検索対象テキストを取得する
 * WindowInfo は title と processName（一覧に表示している exe 名）、それ以外は displayName を使用。
 * 設定でメモにも当てるときは、メモを後ろに足す（改行でつなぐので、語をまたいで当たらない）
 */
function getSearchText(item: AppItem): string {
  if ('hwnd' in item) {
    const { title, processName } = item as WindowInfo;
    return processName ? `${title} ${processName}` : title;
  }
  const { displayName, memo } = item as { displayName: string; memo?: string };
  if (!includeMemo) return displayName;
  return memo ? `${displayName}\n${memo}` : displayName;
}

/**
 * 小文字化済み検索テキストのキャッシュ。
 * キー入力ごとの全アイテム再小文字化を避ける。アイテムはデータ再読込で
 * 作り直されるため、WeakMapで古いオブジェクトごと自動解放される。
 */
const lowerSearchTextCache = new WeakMap<AppItem, string>();
/** メモにも当てるときのキャッシュ（設定を切り替えても作り直さずに済むよう分ける） */
const lowerSearchTextWithMemoCache = new WeakMap<AppItem, string>();

function getLowerSearchText(item: AppItem): string {
  const cache = includeMemo ? lowerSearchTextWithMemoCache : lowerSearchTextCache;
  let text = cache.get(item);
  if (text === undefined) {
    text = getSearchText(item).toLowerCase();
    cache.set(item, text);
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
