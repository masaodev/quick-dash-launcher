import React from 'react';
import { AppItem, LauncherItem, DataFileTab, SearchMode, WindowInfo } from '@common/types';
import { isWindowInfo, isLauncherItem } from '@common/utils/typeGuards';

import { filterItems } from '../utils/dataParser';

/**
 * キーボードショートカット管理フック
 *
 * キーボード操作（タブ切り替え、検索履歴、アイテム選択、実行）を管理します。
 */
export function useKeyboardShortcuts(
  showDataFileTabs: boolean,
  activeTab: string,
  dataFileTabs: DataFileTab[],
  mainItems: AppItem[],
  searchQuery: string,
  selectedIndex: number,
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>,
  setActiveTab: React.Dispatch<React.SetStateAction<string>>,
  navigateToPrevious: () => string | null,
  navigateToNext: () => string | null,
  setSearchQuery: (query: string) => void,
  handleExecuteItem: (item: AppItem) => Promise<void>,
  searchMode: SearchMode,
  windowList: WindowInfo[],
  historyItems: AppItem[],
  toggleSearchMode: () => Promise<void>
) {
  /**
   * アクティブなタブに基づいてアイテムをフィルタリング（キーハンドラ用）
   */
  const getTabFilteredItemsForKeyHandler = (): AppItem[] => {
    if (!showDataFileTabs) {
      // タブ表示OFF: data.txtのみ表示
      return mainItems.filter((item) => !isWindowInfo(item) && item.sourceFile === 'data.txt');
    }
    // タブ表示ON: アクティブなタブに紐付く全ファイルのアイテムを表示
    // アクティブなタブの設定を検索
    const activeTabConfig = dataFileTabs.find((tab) => tab.files.includes(activeTab));
    if (activeTabConfig) {
      // タブに紐付く全ファイルのアイテムを取得
      return mainItems.filter(
        (item) => !isWindowInfo(item) && activeTabConfig.files.includes(item.sourceFile || '')
      );
    }
    // フォールバック: アクティブタブと一致するファイルのアイテムのみ
    return mainItems.filter((item) => !isWindowInfo(item) && item.sourceFile === activeTab);
  };

  /**
   * キーボードイベントハンドラ
   */
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    // Shift+Tab: ウィンドウ検索モード切り替え（最優先）
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      await toggleSearchMode();
      return;
    }

    // Tab: タブ切り替え（通常モード時のみ、複数タブがある場合）
    if (e.key === 'Tab' && searchMode === 'normal' && showDataFileTabs && dataFileTabs.length > 1) {
      e.preventDefault();
      e.stopPropagation();

      // 現在のアクティブタブが属するタブグループのインデックスを探す
      const currentTabIndex = dataFileTabs.findIndex((tab) => tab.files.includes(activeTab));

      if (currentTabIndex === -1) {
        // 見つからない場合は最初のタブへ
        const firstTab = dataFileTabs[0];
        setActiveTab(firstTab.files[0]);
        setSelectedIndex(0);
        return;
      }

      // Tab: 次のタブへ
      const newTabIndex = currentTabIndex < dataFileTabs.length - 1 ? currentTabIndex + 1 : 0;

      const newTab = dataFileTabs[newTabIndex];
      setActiveTab(newTab.files[0]);
      setSelectedIndex(0); // タブ切り替え時は選択インデックスをリセット
      return;
    }

    // ウィンドウモードまたは履歴モードでTabキーが押された場合は無効化
    if (e.key === 'Tab' && (searchMode === 'window' || searchMode === 'history')) {
      e.preventDefault();
      return;
    }

    // 各キー処理で最新のfilteredItemsを計算
    const tabFilteredItems =
      searchMode === 'window'
        ? windowList
        : searchMode === 'history'
          ? historyItems
          : getTabFilteredItemsForKeyHandler();
    const filteredItems = filterItems(tabFilteredItems, searchQuery, searchMode);

    // 検索履歴のナビゲーション（Ctrl + 上下矢印）
    if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      e.stopPropagation();

      const newQuery = e.key === 'ArrowUp' ? navigateToPrevious() : navigateToNext();

      if (newQuery !== null) {
        setSearchQuery(newQuery);
        setSelectedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (
          e.shiftKey &&
          filteredItems[selectedIndex] &&
          isLauncherItem(filteredItems[selectedIndex])
        ) {
          await window.electronAPI.openParentFolder(filteredItems[selectedIndex] as LauncherItem);
        } else if (filteredItems[selectedIndex]) {
          // 統一ハンドラを使用
          await handleExecuteItem(filteredItems[selectedIndex]);
        }
        break;
      case 'ArrowUp':
        if (!e.ctrlKey) {
          // Ctrlキーが押されていない場合のみメニュー選択
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        }
        break;
      case 'ArrowDown':
        if (!e.ctrlKey) {
          // Ctrlキーが押されていない場合のみメニュー選択
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
        }
        break;
      case 'e':
        if (e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          window.electronAPI.toggleEditWindow();
        }
        break;
      case 'w':
        if (e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          window.electronAPI.toggleWorkspaceWindow();
        }
        break;
    }
  };

  return {
    handleKeyDown,
  };
}
