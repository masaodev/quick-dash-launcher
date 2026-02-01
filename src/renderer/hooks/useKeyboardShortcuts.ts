import React from 'react';
import { DESKTOP_TAB } from '@common/constants';
import { AppItem, LauncherItem, DataFileTab, SearchMode, WindowInfo } from '@common/types';
import { isWindowInfo, isLauncherItem } from '@common/types/guards';

import { filterItems } from '../utils/dataParser';
import { filterWindowsByDesktopTab } from '../utils/windowFilter';

/**
 * キーボードショートカットフックのパラメータ
 */
export interface UseKeyboardShortcutsParams {
  showDataFileTabs: boolean;
  activeTab: string;
  dataFileTabs: DataFileTab[];
  mainItems: AppItem[];
  searchQuery: string;
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  navigateToPrevious: () => string | null;
  navigateToNext: () => string | null;
  setSearchQuery: (query: string) => void;
  handleExecuteItem: (item: AppItem) => Promise<void>;
  searchMode: SearchMode;
  windowList: WindowInfo[];
  historyItems: AppItem[];
  toggleSearchMode: () => Promise<void>;
  refreshWindows: () => Promise<void>;
  reloadData: () => Promise<void>;
  desktopCount: number;
  activeDesktopTab: number;
  setActiveDesktopTab: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * キーボードショートカット管理フック
 *
 * キーボード操作（タブ切り替え、検索履歴、アイテム選択、実行）を管理します。
 */
export function useKeyboardShortcuts(params: UseKeyboardShortcutsParams) {
  const {
    showDataFileTabs,
    activeTab,
    dataFileTabs,
    mainItems,
    searchQuery,
    selectedIndex,
    setSelectedIndex,
    setActiveTab,
    navigateToPrevious,
    navigateToNext,
    setSearchQuery,
    handleExecuteItem,
    searchMode,
    windowList,
    historyItems,
    toggleSearchMode,
    refreshWindows,
    reloadData,
    desktopCount,
    activeDesktopTab,
    setActiveDesktopTab,
  } = params;

  /**
   * アクティブなタブに基づいてアイテムをフィルタリング（キーハンドラ用）
   */
  const getTabFilteredItemsForKeyHandler = (): AppItem[] => {
    if (!showDataFileTabs) {
      // タブ表示OFF: activeTab（デフォルト: data.json）のみ表示
      return mainItems.filter((item) => !isWindowInfo(item) && item.sourceFile === activeTab);
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

    // ウィンドウモード時：Tab でデスクトップタブ切り替え
    if (e.key === 'Tab' && searchMode === 'window' && desktopCount > 1) {
      e.preventDefault();
      e.stopPropagation();

      // タブリストを生成（LauncherDesktopTabBarと同じ順序）
      const tabIds: number[] = [DESKTOP_TAB.ALL];
      const hasPinnedWindows = windowList.some((w) => w.isPinned === true);
      if (hasPinnedWindows) {
        tabIds.push(DESKTOP_TAB.PINNED);
      }
      for (let i = 1; i <= desktopCount; i++) {
        tabIds.push(i);
      }

      // 現在のタブのインデックスを探す
      const currentIndex = tabIds.indexOf(activeDesktopTab);
      const nextIndex = currentIndex < tabIds.length - 1 ? currentIndex + 1 : 0;
      setActiveDesktopTab(tabIds[nextIndex]);
      setSelectedIndex(0);
      return;
    }

    // 履歴モードでTabキーが押された場合は無効化
    if (e.key === 'Tab' && searchMode === 'history') {
      e.preventDefault();
      return;
    }

    // 各キー処理で最新のfilteredItemsを計算
    const tabFilteredItems =
      searchMode === 'window'
        ? filterWindowsByDesktopTab(windowList, activeDesktopTab)
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

    // ウィンドウモード時：Ctrl+左右矢印で選択中のウィンドウを仮想デスクトップ間移動
    // 「すべて」「ピン止め」タブでは無効
    if (searchMode === 'window' && e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      e.stopPropagation();

      // 「すべて」「ピン止め」タブでは移動不可
      if (activeDesktopTab === DESKTOP_TAB.ALL || activeDesktopTab === DESKTOP_TAB.PINNED) return;

      const selectedWindow = filteredItems[selectedIndex] as WindowInfo | undefined;
      if (!selectedWindow || desktopCount < 2) return;

      // ピン止めされたウィンドウは移動不可
      if (selectedWindow.isPinned) return;

      const currentDesktop = selectedWindow.desktopNumber || 1;
      let targetDesktop: number;

      if (e.key === 'ArrowRight') {
        // 右へ移動（次のデスクトップ）
        if (currentDesktop >= desktopCount) return; // 端に達したら何もしない
        targetDesktop = currentDesktop + 1;
      } else {
        // 左へ移動（前のデスクトップ）
        if (currentDesktop <= 1) return; // 端に達したら何もしない
        targetDesktop = currentDesktop - 1;
      }

      // ウィンドウを移動してリストを更新
      window.electronAPI.moveWindowToDesktop(selectedWindow.hwnd, targetDesktop).then((result) => {
        if (result.success) {
          refreshWindows();
        }
      });
      return;
    }

    // ウィンドウモード時：Ctrl+Pで選択中のウィンドウをピン留め/解除トグル
    if (searchMode === 'window' && e.ctrlKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      e.stopPropagation();

      const selectedWindow = filteredItems[selectedIndex] as WindowInfo | undefined;
      if (!selectedWindow) return;

      const isPinned = await window.electronAPI.isWindowPinned(selectedWindow.hwnd);
      const action = isPinned ? 'unpin' : 'pin';
      const result = isPinned
        ? await window.electronAPI.unPinWindow(selectedWindow.hwnd)
        : await window.electronAPI.pinWindow(selectedWindow.hwnd);

      if (result.success) {
        const message =
          action === 'unpin'
            ? 'ウィンドウの固定を解除しました'
            : 'ウィンドウを全デスクトップに固定しました';
        window.electronAPI.showToastWindow(message, 'success');
        await refreshWindows();
      } else {
        const actionLabel = action === 'unpin' ? '固定解除' : '固定';
        window.electronAPI.showToastWindow(
          `${actionLabel}に失敗しました: ${result.error || '不明なエラー'}`,
          'error'
        );
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
      case 'F5':
        e.preventDefault();
        e.stopPropagation();
        if (searchMode === 'window') {
          await refreshWindows();
        } else if (searchMode === 'normal') {
          await reloadData();
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
