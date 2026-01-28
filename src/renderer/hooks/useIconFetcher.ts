import React from 'react';
import { AppItem, LauncherItem, DataFileTab } from '@common/types';
import { isWindowInfo, isLauncherItem } from '@common/types/guards';

import { debugInfo } from '../utils/debug';

type IconResults = {
  favicons: Record<string, string | null>;
  icons: Record<string, string | null>;
};

type UseIconFetcherOptions = {
  mainItems: AppItem[];
  setMainItems: React.Dispatch<React.SetStateAction<AppItem[]>>;
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

function extractUrlItems(items: AppItem[], requireNoIcon: boolean): LauncherItem[] {
  return items.filter(
    (item) => isLauncherItem(item) && item.type === 'url' && (!requireNoIcon || hasNoIcon(item))
  ) as LauncherItem[];
}

function extractIconItems(items: AppItem[], requireNoIcon: boolean): LauncherItem[] {
  return items.filter(
    (item) =>
      isLauncherItem(item) &&
      item.type !== 'url' &&
      item.type !== 'folder' &&
      (!requireNoIcon || hasNoIcon(item))
  ) as LauncherItem[];
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
  const handleRefreshAll = async (loadItems: () => Promise<AppItem[]>): Promise<void> => {
    debugInfo('すべての更新を開始');

    const loadedItems = await loadItems();
    const urlItems = extractUrlItems(loadedItems, false);
    const iconItems = extractIconItems(loadedItems, false);

    if (urlItems.length > 0 || iconItems.length > 0) {
      const results = await window.electronAPI.fetchIconsCombined(urlItems, iconItems, true);
      setMainItems(applyIconsToItems(loadedItems, results));
    }

    debugInfo('すべての更新が完了');
  };

  const handleFetchMissingIcons = async (): Promise<void> => {
    debugInfo('未取得アイコンの取得を開始（全タブ）');

    const urlItems = extractUrlItems(mainItems, true);
    const iconItems = extractIconItems(mainItems, true);

    if (urlItems.length === 0 && iconItems.length === 0) {
      debugInfo('取得対象のアイテムがありません');
      return;
    }

    const results = await window.electronAPI.fetchIconsCombined(urlItems, iconItems, false);
    setMainItems((prevItems) => applyIconsToItems(prevItems, results));

    // アイコン取得エラー記録を再読み込み
    await reloadIconFetchErrors();

    debugInfo('未取得アイコンの取得が完了（全タブ）');
  };

  const handleFetchMissingIconsCurrentTab = async (): Promise<void> => {
    debugInfo('未取得アイコンの取得を開始（現在のタブ）');

    const currentTabItems = getCurrentTabItems();
    const urlItems = extractUrlItems(currentTabItems, true);
    const iconItems = extractIconItems(currentTabItems, true);

    if (urlItems.length === 0 && iconItems.length === 0) {
      debugInfo('取得対象のアイテムがありません（現在のタブ）');
      return;
    }

    const results = await window.electronAPI.fetchIconsCombined(urlItems, iconItems, false);
    setMainItems((prevItems) => applyIconsToItems(prevItems, results));

    // アイコン取得エラー記録を再読み込み
    await reloadIconFetchErrors();

    debugInfo('未取得アイコンの取得が完了（現在のタブ）');
  };

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

  return {
    handleRefreshAll,
    handleFetchMissingIcons,
    handleFetchMissingIconsCurrentTab,
  };
}
