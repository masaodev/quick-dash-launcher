import {
  AppItem,
  SearchMode,
  WindowInfo,
  LauncherItem,
  GroupItem,
  WindowOperationItem,
} from '../../common/types';

/**
 * アイテムをクエリでフィルタリングする
 * 複数キーワードのAND検索に対応
 *
 * @param items - フィルタリング対象のアイテム配列
 * @param query - 検索クエリ（スペース区切りで複数キーワード指定可能）
 * @param mode - 検索モード（'normal' | 'window'）
 * @returns フィルタリングされたアイテム配列
 */
export function filterItems(
  items: AppItem[],
  query: string,
  mode: SearchMode = 'normal'
): AppItem[] {
  if (!query) {
    return items;
  }

  // ウィンドウモードの場合
  if (mode === 'window') {
    // '<'を除去してフィルタリング
    const windowQuery = query.startsWith('<') ? query.substring(1) : query;
    return filterWindowItems(items as WindowInfo[], windowQuery);
  }

  // 通常モード: 既存のロジック
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 0);

  return items.filter((item) => {
    // WindowInfo, WindowOperationItem, LauncherItem, GroupItem に対応
    let itemText: string;
    if ('hwnd' in item) {
      // WindowInfo
      itemText = (item as WindowInfo).title.toLowerCase();
    } else if (item.type === 'windowOperation') {
      // WindowOperationItem
      itemText = (item as WindowOperationItem).name.toLowerCase();
    } else {
      // LauncherItem or GroupItem
      itemText = (item as LauncherItem | GroupItem).name.toLowerCase();
    }

    return keywords.every((keyword) => itemText.includes(keyword));
  });
}

/**
 * ウィンドウアイテム用のフィルタリング関数
 * ウィンドウタイトルでフィルタリング（スペース区切りAND検索）
 *
 * @param windows - ウィンドウ情報の配列
 * @param query - 検索クエリ
 * @returns フィルタリングされたウィンドウ配列
 */
function filterWindowItems(windows: WindowInfo[], query: string): WindowInfo[] {
  if (!query) {
    return windows;
  }

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 0);

  return windows.filter((win) => {
    const titleText = win.title.toLowerCase();
    return keywords.every((keyword) => titleText.includes(keyword));
  });
}
