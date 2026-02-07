import React from 'react';
import toast from 'react-hot-toast';
import { DESKTOP_TAB } from '@common/constants';
import { AppItem, DataFileTab, LauncherItem, SearchMode, WindowInfo } from '@common/types';
import { isLauncherItem, isWindowInfo } from '@common/types/guards';

import { filterItems } from '../utils/dataParser';
import { filterWindowsByDesktopTab } from '../utils/windowFilter';

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

export function useKeyboardShortcuts(params: UseKeyboardShortcutsParams): {
  handleKeyDown: (e: React.KeyboardEvent) => Promise<void>;
} {
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

  function getTabFilteredItems(): AppItem[] {
    if (!showDataFileTabs) {
      return mainItems.filter((item) => !isWindowInfo(item) && item.sourceFile === activeTab);
    }

    const activeTabConfig = dataFileTabs.find((tab) => tab.files.includes(activeTab));
    if (activeTabConfig) {
      return mainItems.filter(
        (item) => !isWindowInfo(item) && activeTabConfig.files.includes(item.sourceFile || '')
      );
    }

    return mainItems.filter((item) => !isWindowInfo(item) && item.sourceFile === activeTab);
  }

  function buildDesktopTabIds(): number[] {
    const tabIds: number[] = [DESKTOP_TAB.ALL];
    const hasPinnedWindows = windowList.some((w) => w.isPinned === true);
    if (hasPinnedWindows) {
      tabIds.push(DESKTOP_TAB.PINNED);
    }
    for (let i = 1; i <= desktopCount; i++) {
      tabIds.push(i);
    }
    return tabIds;
  }

  function getFilteredItems(): AppItem[] {
    if (searchMode === 'window') {
      return filterWindowsByDesktopTab(windowList, activeDesktopTab);
    }
    if (searchMode === 'history') {
      return historyItems;
    }
    return getTabFilteredItems();
  }

  async function handleKeyDown(e: React.KeyboardEvent): Promise<void> {
    // Shift+Tab: ウィンドウ検索モード切り替え
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      await toggleSearchMode();
      return;
    }

    // Tab: タブ切り替え（通常モード時）
    if (e.key === 'Tab' && searchMode === 'normal' && showDataFileTabs && dataFileTabs.length > 1) {
      e.preventDefault();
      e.stopPropagation();

      const currentTabIndex = dataFileTabs.findIndex((tab) => tab.files.includes(activeTab));
      const newTabIndex =
        currentTabIndex === -1 || currentTabIndex >= dataFileTabs.length - 1
          ? 0
          : currentTabIndex + 1;

      setActiveTab(dataFileTabs[newTabIndex].files[0]);
      setSelectedIndex(0);
      return;
    }

    // Tab: デスクトップタブ切り替え（ウィンドウモード時）
    if (e.key === 'Tab' && searchMode === 'window' && desktopCount > 1) {
      e.preventDefault();
      e.stopPropagation();

      const tabIds = buildDesktopTabIds();
      const currentIndex = tabIds.indexOf(activeDesktopTab);
      const nextIndex = currentIndex < tabIds.length - 1 ? currentIndex + 1 : 0;
      setActiveDesktopTab(tabIds[nextIndex]);
      setSelectedIndex(0);
      return;
    }

    // Tab: 履歴モードでは無効化
    if (e.key === 'Tab' && searchMode === 'history') {
      e.preventDefault();
      return;
    }

    const filteredItems = filterItems(getFilteredItems(), searchQuery, searchMode);

    // Ctrl + 上下矢印: 検索履歴ナビゲーション
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

    // Ctrl + 左右矢印: ウィンドウをデスクトップ間移動（ウィンドウモード時）
    if (searchMode === 'window' && e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      e.stopPropagation();

      if (activeDesktopTab === DESKTOP_TAB.ALL || activeDesktopTab === DESKTOP_TAB.PINNED) return;

      const selectedWindow = filteredItems[selectedIndex] as WindowInfo | undefined;
      if (!selectedWindow || desktopCount < 2 || selectedWindow.isPinned) return;

      const currentDesktop = selectedWindow.desktopNumber || 1;
      const targetDesktop = e.key === 'ArrowRight' ? currentDesktop + 1 : currentDesktop - 1;

      if (targetDesktop < 1 || targetDesktop > desktopCount) return;

      const result = await window.electronAPI.moveWindowToDesktop(
        selectedWindow.hwnd,
        targetDesktop
      );
      if (result.success) {
        await refreshWindows();
      }
      return;
    }

    // Ctrl+P: ウィンドウのピン留めトグル（ウィンドウモード時）
    if (searchMode === 'window' && e.ctrlKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      e.stopPropagation();

      const selectedWindow = filteredItems[selectedIndex] as WindowInfo | undefined;
      if (!selectedWindow) return;

      const isPinned = await window.electronAPI.isWindowPinned(selectedWindow.hwnd);
      const result = isPinned
        ? await window.electronAPI.unPinWindow(selectedWindow.hwnd)
        : await window.electronAPI.pinWindow(selectedWindow.hwnd);

      if (result.success) {
        toast.success(
          isPinned ? 'ウィンドウの固定を解除しました' : 'ウィンドウを全デスクトップに固定しました'
        );
        await refreshWindows();
      } else {
        toast.error(
          `${isPinned ? '固定解除' : '固定'}に失敗しました: ${result.error || '不明なエラー'}`
        );
      }
      return;
    }

    // Ctrl+D: ウィンドウを閉じる（ウィンドウモード時）
    if (searchMode === 'window' && e.ctrlKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      e.stopPropagation();

      const selectedWindow = filteredItems[selectedIndex] as WindowInfo | undefined;
      if (!selectedWindow) return;

      const result = await window.electronAPI.closeWindow(selectedWindow.hwnd);

      if (result.success) {
        toast.success('ウィンドウを閉じました');
        await refreshWindows();
      } else {
        toast.error(`ウィンドウを閉じるのに失敗しました: ${result.error || '不明なエラー'}`);
      }
      return;
    }

    const selectedItem = filteredItems[selectedIndex];

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (!selectedItem) return;
        if (e.shiftKey && isLauncherItem(selectedItem)) {
          await window.electronAPI.openParentFolder(selectedItem as LauncherItem);
        } else {
          await handleExecuteItem(selectedItem);
        }
        return;

      case 'F5':
        e.preventDefault();
        e.stopPropagation();
        if (searchMode === 'window') {
          await refreshWindows();
        } else if (searchMode === 'normal') {
          await reloadData();
        }
        return;

      case 'ArrowUp':
        if (!e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        }
        return;

      case 'ArrowDown':
        if (!e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
        }
        return;

      case 'e':
        if (e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          window.electronAPI.toggleEditWindow();
        }
        return;

      case 'w':
        if (e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          window.electronAPI.toggleWorkspaceWindow();
        }
        return;
    }
  }

  return { handleKeyDown };
}
