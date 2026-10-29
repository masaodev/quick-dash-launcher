import { AppItem, SearchMode, WindowInfo } from '@common/types';

/** 検索で区別しない違い（設定 searchIgnoreWidth・searchIgnoreKana）。各ウィンドウが設定を読んで入れる */
export interface SearchNormalization {
  /** 全角と半角を区別しない */
  ignoreWidth: boolean;
  /** ひらがなとカタカナを区別しない */
  ignoreKana: boolean;
}

let normalization: SearchNormalization = { ignoreWidth: false, ignoreKana: false };

/** 検索で区別しない違いを切り替える（設定の読み込み・変更のたびに呼ぶ） */
export function setSearchNormalization(next: SearchNormalization): void {
  normalization = { ...next };
}

/** カタカナ（ァ〜ヶ）をひらがなにする。長音（ー）などはそのまま */
function katakanaToHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/**
 * 検索で照合する形にそろえる。大文字・小文字はいつも区別しない
 *
 * 設定に応じて、NFKC で全角英数を半角に・半角カナを全角にそろえ（`ｃｈｒｏｍｅ` で `Chrome`、`ﾃｽﾄ` で `テスト`）、
 * カタカナをひらがなにそろえる（`てすと` で `テスト`）。検索語と照合する文の両方にかける
 */
export function normalizeForSearch(text: string): string {
  let result = normalization.ignoreWidth ? text.normalize('NFKC') : text;
  if (normalization.ignoreKana) result = katakanaToHiragana(result);
  return result.toLowerCase();
}

/**
 * クエリ文字列をキーワード配列に分割する（照合する文には normalizeForSearch をかけてから比べる）
 */
export function parseKeywords(query: string): string[] {
  return normalizeForSearch(query)
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
const searchTextCaches = new Map<string, WeakMap<AppItem, string>>();

/** 設定（メモ・区別しない違い）の組ごとにキャッシュを分ける（切り替えても作り直さずに済む） */
function getSearchTextCache(): WeakMap<AppItem, string> {
  const key = `${includeMemo}|${normalization.ignoreWidth}|${normalization.ignoreKana}`;
  let cache = searchTextCaches.get(key);
  if (!cache) {
    cache = new WeakMap();
    searchTextCaches.set(key, cache);
  }
  return cache;
}

function getLowerSearchText(item: AppItem): string {
  const cache = getSearchTextCache();
  let text = cache.get(item);
  if (text === undefined) {
    text = normalizeForSearch(getSearchText(item));
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
