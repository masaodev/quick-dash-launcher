import React from 'react';

import { AppItem, LauncherItem, DataFileTab } from '../../common/types';
import { debugInfo } from '../utils/debug';

/**
 * アイコン取得管理フック
 *
 * アイコンの一括取得、未取得アイコンの取得を管理します。
 */
export function useIconFetcher(
  mainItems: AppItem[],
  setMainItems: React.Dispatch<React.SetStateAction<AppItem[]>>,
  showDataFileTabs: boolean,
  activeTab: string,
  dataFileTabs: DataFileTab[]
) {
  /**
   * すべてのアイテムとアイコンを更新（強制取得）
   */
  const handleRefreshAll = async (loadItems: () => Promise<AppItem[]>) => {
    debugInfo('すべての更新を開始');

    // 1. データファイルの再読み込み
    const loadedItems = await loadItems();

    // 2. 統合プログレスAPIで全アイコン取得（強制）
    const allUrlItems = loadedItems.filter((item) => item.type === 'url') as LauncherItem[];

    const allIconItems = loadedItems.filter(
      (item) => item.type !== 'url' && item.type !== 'group' && item.type !== 'folder'
    ) as LauncherItem[];

    if (allUrlItems.length > 0 || allIconItems.length > 0) {
      const results = await window.electronAPI.fetchIconsCombined(allUrlItems, allIconItems);

      // 取得したアイコンをアイテムに適用
      const updateItemsWithIcons = (items: AppItem[]) => {
        return items.map((item) => {
          if (item.type === 'url' && results.favicons[(item as LauncherItem).path]) {
            return { ...item, icon: results.favicons[(item as LauncherItem).path] || undefined };
          } else if (
            item.type !== 'url' &&
            item.type !== 'group' &&
            results.icons[(item as LauncherItem).path]
          ) {
            return { ...item, icon: results.icons[(item as LauncherItem).path] || undefined };
          }
          return item;
        });
      };

      setMainItems(updateItemsWithIcons(loadedItems));
    }

    debugInfo('すべての更新が完了');
  };

  /**
   * 未取得アイコンを取得（全タブ）
   */
  const handleFetchMissingIcons = async () => {
    debugInfo('未取得アイコンの取得を開始（全タブ）');

    // 統合プログレスAPIを使用
    // URLアイテムの抽出（アイコン未設定のみ）
    const urlItems = mainItems.filter(
      (item) => item.type === 'url' && !('icon' in item && item.icon)
    ) as LauncherItem[];

    // EXE/ファイル/カスタムURIアイテムの抽出（アイコン未設定のみ、フォルダとグループを除外）
    const iconItems = mainItems.filter(
      (item) =>
        item.type !== 'url' &&
        item.type !== 'group' &&
        item.type !== 'folder' &&
        !('icon' in item && item.icon)
    ) as LauncherItem[];

    if (urlItems.length === 0 && iconItems.length === 0) {
      debugInfo('取得対象のアイテムがありません');
      return;
    }

    // 統合APIを呼び出し
    const results = await window.electronAPI.fetchIconsCombined(urlItems, iconItems);

    // 取得したアイコンをアイテムに適用
    const updateItemsWithIcons = (items: AppItem[]) => {
      return items.map((item) => {
        if (item.type === 'url' && results.favicons[(item as LauncherItem).path]) {
          return { ...item, icon: results.favicons[(item as LauncherItem).path] || undefined };
        } else if (
          item.type !== 'url' &&
          item.type !== 'group' &&
          results.icons[(item as LauncherItem).path]
        ) {
          return { ...item, icon: results.icons[(item as LauncherItem).path] || undefined };
        }
        return item;
      });
    };

    setMainItems(updateItemsWithIcons(mainItems));
    debugInfo('未取得アイコンの取得が完了（全タブ）');
  };

  /**
   * 未取得アイコンを取得（現在のタブのみ）
   */
  const handleFetchMissingIconsCurrentTab = async () => {
    debugInfo('未取得アイコンの取得を開始（現在のタブ）');

    // 現在のタブのアイテムのみをフィルタリング
    let currentTabItems: AppItem[];
    if (!showDataFileTabs) {
      currentTabItems = mainItems.filter((item) => item.sourceFile === 'data.txt');
    } else {
      // アクティブなタブに紐付く全ファイルのアイテムを取得
      const activeTabConfig = dataFileTabs.find((tab) => tab.files.includes(activeTab));
      if (activeTabConfig) {
        currentTabItems = mainItems.filter((item) =>
          activeTabConfig.files.includes(item.sourceFile || '')
        );
      } else {
        currentTabItems = mainItems.filter((item) => item.sourceFile === activeTab);
      }
    }

    // 統合プログレスAPIを使用
    // URLアイテムの抽出（アイコン未設定のみ）
    const urlItems = currentTabItems.filter(
      (item) => item.type === 'url' && !('icon' in item && item.icon)
    ) as LauncherItem[];

    // EXE/ファイル/カスタムURIアイテムの抽出（アイコン未設定のみ、フォルダとグループを除外）
    const iconItems = currentTabItems.filter(
      (item) =>
        item.type !== 'url' &&
        item.type !== 'group' &&
        item.type !== 'folder' &&
        !('icon' in item && item.icon)
    ) as LauncherItem[];

    if (urlItems.length === 0 && iconItems.length === 0) {
      debugInfo('取得対象のアイテムがありません（現在のタブ）');
      return;
    }

    // 統合APIを呼び出し
    const results = await window.electronAPI.fetchIconsCombined(urlItems, iconItems);

    // 取得したアイコンをアイテムに適用
    const updateItemsWithIcons = (items: AppItem[]) => {
      return items.map((item) => {
        if (item.type === 'url' && results.favicons[(item as LauncherItem).path]) {
          return { ...item, icon: results.favicons[(item as LauncherItem).path] || undefined };
        } else if (
          item.type !== 'url' &&
          item.type !== 'group' &&
          results.icons[(item as LauncherItem).path]
        ) {
          return { ...item, icon: results.icons[(item as LauncherItem).path] || undefined };
        }
        return item;
      });
    };

    setMainItems(updateItemsWithIcons(mainItems));
    debugInfo('未取得アイコンの取得が完了（現在のタブ）');
  };

  return {
    handleRefreshAll,
    handleFetchMissingIcons,
    handleFetchMissingIconsCurrentTab,
  };
}
