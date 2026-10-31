import { DESKTOP_TAB } from '@common/constants';
import type { AppItem, DataFileTab, SearchMode, WindowInfo } from '@common/types';
import { isWindowInfo } from '@common/types/guards';

import { filterItems } from './dataParser';
import { getActiveTabFiles } from './tabFiles';

/**
 * 検索で一覧が 0 件のとき、別の場所に合うものがあるか
 * - otherTab: 今のタブには無いが、他のタブ（データファイルのタブ／デスクトップのタブ）にある
 * - normalSearch: ウィンドウ検索で無いが、通常の検索に戻れば合うアイテムがある
 * - null: どこにも無い（今の案内のまま）
 */
export type NoMatchElsewhere = 'otherTab' | 'normalSearch' | null;

interface NoMatchElsewhereParams {
  searchMode: SearchMode;
  searchQuery: string;
  /** ランチャーのアイテム（ウィンドウを含んでもよい） */
  mainItems: AppItem[];
  dataFileTabs: DataFileTab[];
  showDataFileTabs: boolean;
  /** 通常モードで今のタブ（ファイル名） */
  activeTab: string;
  windowList: WindowInfo[];
  /** ウィンドウ検索でデスクトップのタブを出しているか */
  showDesktopTabs: boolean;
  activeDesktopTab: number;
}

/** 通常の検索で、どれかのタブに出るアイテムが検索語に合うか（タブ表示 OFF なら今のタブに出るファイルだけを見る） */
function hasNormalMatch(
  mainItems: AppItem[],
  query: string,
  dataFileTabs: DataFileTab[],
  showDataFileTabs: boolean,
  activeTab: string
): boolean {
  const reachableFiles = showDataFileTabs
    ? new Set(dataFileTabs.flatMap((tab) => tab.files))
    : new Set(getActiveTabFiles(dataFileTabs, activeTab));
  const reachable = mainItems.filter(
    (item) => !isWindowInfo(item) && reachableFiles.has(item.sourceFile || '')
  );
  return filterItems(reachable, query).length > 0;
}

/**
 * 今の一覧が 0 件のときに、別の場所に合うものがあるかを判定する（一覧が空の案内に使う）。
 * 今の一覧が 0 件であることは呼び出し側で確かめておく
 */
export function findNoMatchElsewhere({
  searchMode,
  searchQuery,
  mainItems,
  dataFileTabs,
  showDataFileTabs,
  activeTab,
  windowList,
  showDesktopTabs,
  activeDesktopTab,
}: NoMatchElsewhereParams): NoMatchElsewhere {
  if (!searchQuery.trim()) return null;

  if (searchMode === 'window') {
    // 「すべて」のタブ以外を見ていて、すべてのウィンドウの中には合うものがある
    if (
      showDesktopTabs &&
      activeDesktopTab !== DESKTOP_TAB.ALL &&
      filterItems(windowList, searchQuery, 'window').length > 0
    ) {
      return 'otherTab';
    }
    // ウィンドウ検索の印の先頭の '<' は通常の検索では検索語に含めない
    const normalQuery = searchQuery.startsWith('<') ? searchQuery.substring(1) : searchQuery;
    if (!normalQuery.trim()) return null;
    return hasNormalMatch(mainItems, normalQuery, dataFileTabs, showDataFileTabs, activeTab)
      ? 'normalSearch'
      : null;
  }

  // Tab で切り替えられるタブが 2 つ以上あるときだけ「他のタブ」を案内する
  if (!showDataFileTabs || dataFileTabs.length < 2) return null;
  return hasNormalMatch(mainItems, searchQuery, dataFileTabs, showDataFileTabs, activeTab)
    ? 'otherTab'
    : null;
}
