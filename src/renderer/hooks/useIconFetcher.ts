import { type Dispatch, type SetStateAction } from 'react';
import { AppItem, LauncherItem, DataFileTab } from '@common/types';
import { isWindowInfo, isLauncherItem } from '@common/types/guards';

import { debugInfo } from '../utils/debug';

type IconResults = {
  favicons: Record<string, string | null>;
  icons: Record<string, string | null>;
};

type UseIconFetcherOptions = {
  mainItems: AppItem[];
  setMainItems: Dispatch<SetStateAction<AppItem[]>>;
  showDataFileTabs: boolean;
  activeTab: string;
  dataFileTabs: DataFileTab[];
  reloadIconFetchErrors: () => Promise<void>;
};

type UseIconFetcherResult = {
  handleRefreshAll: (loadItems: () => Promise<AppItem[]>) => Promise<void>;
  handleFetchMissingIcons: () => Promise<void>;
  handleFetchMissingIconsCurrentTab: () => Promise<void>;
};

function hasNoIcon(item: AppItem): boolean {
  return !('icon' in item && item.icon);
}

type ItemFilter = 'url' | 'icon';

function extractItems(
  items: AppItem[],
  filter: ItemFilter,
  requireNoIcon: boolean
): LauncherItem[] {
  return items.filter((item): item is LauncherItem => {
    if (!isLauncherItem(item)) return false;
    if (requireNoIcon && !hasNoIcon(item)) return false;

    if (filter === 'url') {
      return item.type === 'url';
    }
    return item.type !== 'url' && item.type !== 'folder';
  });
}

function applyIconsToItems(items: AppItem[], results: IconResults): AppItem[] {
  return items.map((item) => {
    if (!isLauncherItem(item)) return item;
    const icon = item.type === 'url' ? results.favicons[item.path] : results.icons[item.path];
    return icon ? { ...item, icon } : item;
  });
}

/**
 * アイコン取得管理フック
 */
export function useIconFetcher(options: UseIconFetcherOptions): UseIconFetcherResult {
  const {
    mainItems,
    setMainItems,
    showDataFileTabs,
    activeTab,
    dataFileTabs,
    reloadIconFetchErrors,
  } = options;

  function getCurrentTabItems(): AppItem[] {
    if (!showDataFileTabs) {
      return mainItems.filter((item) => !isWindowInfo(item) && item.sourceFile === 'data.json');
    }

    const activeTabConfig = dataFileTabs.find((tab) => tab.files.includes(activeTab));
    const targetFiles = activeTabConfig ? activeTabConfig.files : [activeTab];

    return mainItems.filter(
      (item) => !isWindowInfo(item) && targetFiles.includes(item.sourceFile || '')
    );
  }

  async function fetchAndApplyIcons(
    items: AppItem[],
    requireNoIcon: boolean,
    forceRefetch: boolean
  ): Promise<IconResults | null> {
    const urlItems = extractItems(items, 'url', requireNoIcon);
    const iconItems = extractItems(items, 'icon', requireNoIcon);

    if (urlItems.length === 0 && iconItems.length === 0) {
      return null;
    }

    return window.electronAPI.fetchIconsCombined(urlItems, iconItems, forceRefetch);
  }

  const handleRefreshAll = async (loadItems: () => Promise<AppItem[]>): Promise<void> => {
    debugInfo('すべての更新を開始');

    const loadedItems = await loadItems();
    const results = await fetchAndApplyIcons(loadedItems, false, true);

    if (results) {
      setMainItems(applyIconsToItems(loadedItems, results));
    }

    debugInfo('すべての更新が完了');
  };

  const handleFetchMissingIcons = async (): Promise<void> => {
    debugInfo('未取得アイコンの取得を開始（全タブ）');

    const results = await fetchAndApplyIcons(mainItems, true, false);

    if (!results) {
      debugInfo('取得対象のアイテムがありません');
      return;
    }

    setMainItems((prevItems) => applyIconsToItems(prevItems, results));
    await reloadIconFetchErrors();

    debugInfo('未取得アイコンの取得が完了（全タブ）');
  };

  const handleFetchMissingIconsCurrentTab = async (): Promise<void> => {
    debugInfo('未取得アイコンの取得を開始（現在のタブ）');

    const currentTabItems = getCurrentTabItems();
    const results = await fetchAndApplyIcons(currentTabItems, true, false);

    if (!results) {
      debugInfo('取得対象のアイテムがありません（現在のタブ）');
      return;
    }

    setMainItems((prevItems) => applyIconsToItems(prevItems, results));
    await reloadIconFetchErrors();

    debugInfo('未取得アイコンの取得が完了（現在のタブ）');
  };

  return {
    handleRefreshAll,
    handleFetchMissingIcons,
    handleFetchMissingIconsCurrentTab,
  };
}
