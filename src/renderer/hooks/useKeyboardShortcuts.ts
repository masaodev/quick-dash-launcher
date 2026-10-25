import React from 'react';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TAB } from '@common/constants';
import { AppItem, DataFileTab, LauncherItem, SearchMode, WindowInfo } from '@common/types';
import { isLauncherItem, isWindowInfo } from '@common/types/guards';

import { filterItems } from '../utils/dataParser';
import { filterWindowsByDesktopTab } from '../utils/windowFilter';

import type { WindowOperations } from './useWindowOperations';
import type { WindowMultiSelect } from './useWindowMultiSelect';

export interface UseKeyboardShortcutsParams {
  showDataFileTabs: boolean;
  activeTab: string;
  dataFileTabs: DataFileTab[];
  mainItems: AppItem[];
  /** 検索・タブ絞り込み適用済みの表示中アイテム（App側のuseMemo結果を共有） */
  filteredItems: AppItem[];
  searchQuery: string;
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  navigateToPrevious: () => string | null;
  navigateToNext: () => string | null;
  setSearchQuery: (query: string) => void;
  handleExecuteItem: (item: AppItem) => Promise<void>;
  /** 選択中のアイテムの編集画面を開く（F2。右クリックメニューの「編集」と同じ） */
  handleEditItem: (item: AppItem) => void;
  searchMode: SearchMode;
  windowList: WindowInfo[];
  toggleSearchMode: () => Promise<void>;
  refreshWindows: () => Promise<void>;
  /** ウィンドウの閉じる・固定・移動（右クリックメニューと共通） */
  windowOps: WindowOperations;
  /** ウィンドウ検索の複数選択 */
  windowSelection: WindowMultiSelect;
  reloadData: () => Promise<void>;
  desktopCount: number;
  /** ウィンドウの固定（Ctrl+P）が使えるか。仮想デスクトップ非対応の環境では false */
  canPinWindow: boolean;
  activeDesktopTab: number;
  setActiveDesktopTab: React.Dispatch<React.SetStateAction<number>>;
  /** Ctrl+C: 選んでいるアイテムのパスをコピー（検索欄で文字を選んでいるときは文字のコピーのまま） */
  onCopyPath?: (item: LauncherItem) => void | Promise<void>;
  /** Ctrl+Shift+C: 選んでいるアイテムの親フォルダのパスをコピー */
  onCopyParentPath?: (item: LauncherItem) => void | Promise<void>;
  /** Shift+F10・アプリケーションキー: 選んでいる行の右クリックメニューを出す */
  onOpenContextMenu?: (index: number) => void;
  /** Ctrl+Shift+Enter: 選んでいるアイテムを管理者として実行（対象外の種類は呼び出し側で知らせる） */
  onRunAsAdmin?: (item: AppItem) => void | Promise<void>;
}

export function useKeyboardShortcuts(params: UseKeyboardShortcutsParams): {
  handleKeyDown: (e: React.KeyboardEvent) => Promise<void>;
  /** 次のタブへ切り替える（Tab キーと同じ動き） */
  switchToNextTab: () => void;
} {
  const { t } = useTranslation();
  const {
    showDataFileTabs,
    activeTab,
    dataFileTabs,
    mainItems,
    filteredItems,
    searchQuery,
    selectedIndex,
    setSelectedIndex,
    setActiveTab,
    navigateToPrevious,
    navigateToNext,
    setSearchQuery,
    handleExecuteItem,
    handleEditItem,
    searchMode,
    windowList,
    toggleSearchMode,
    refreshWindows,
    windowOps,
    windowSelection,
    reloadData,
    desktopCount,
    canPinWindow,
    activeDesktopTab,
    setActiveDesktopTab,
    onCopyPath,
    onCopyParentPath,
    onOpenContextMenu,
    onRunAsAdmin,
  } = params;

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

  /** ウィンドウ検索のカーソルの行（閉じている途中のものを除いた並びで数える） */
  function cursorWindow(): WindowInfo | undefined {
    const candidates = (filteredItems as WindowInfo[]).filter((w) => !windowOps.isClosing(w.hwnd));
    return candidates[selectedIndex];
  }

  /** 操作の対象: 選んでいればそれ、なければカーソルの行（閉じている途中のものは除く） */
  function windowTargets(): WindowInfo[] {
    return windowSelection.targetsFor(cursorWindow()).filter((w) => !windowOps.isClosing(w.hwnd));
  }

  /**
   * 配列を現在位置から巡回し、条件を満たす次のインデックスを返す。
   * 見つからなければ現在位置をそのまま返す。
   */
  function findNextIndex(
    length: number,
    currentIndex: number,
    predicate: (i: number) => boolean
  ): number {
    for (let offset = 1; offset <= length; offset++) {
      const candidate = (currentIndex + offset) % length;
      if (predicate(candidate)) return candidate;
    }
    return currentIndex;
  }

  /** Tab で切り替えられるタブがあるか */
  function canSwitchTab(): boolean {
    return searchMode === 'window' ? desktopCount > 1 : showDataFileTabs && dataFileTabs.length > 1;
  }

  /**
   * 次のタブへ切り替える（Tab キーと、一覧が空のときの案内のリンク）。
   * 検索中は合うものがあるタブまで飛ばす
   */
  function switchToNextTab(): void {
    if (!canSwitchTab()) return;

    if (searchMode === 'normal') {
      const currentTabIndex = dataFileTabs.findIndex((tab) => tab.files.includes(activeTab));

      const newTabIndex = findNextIndex(dataFileTabs.length, currentTabIndex, (i) => {
        if (!searchQuery) return true;
        const tabItems = mainItems.filter(
          (item) => !isWindowInfo(item) && dataFileTabs[i].files.includes(item.sourceFile || '')
        );
        return filterItems(tabItems, searchQuery).length > 0;
      });
      setActiveTab(dataFileTabs[newTabIndex].files[0]);
      setSelectedIndex(0);
      return;
    }

    const tabIds = buildDesktopTabIds();
    const currentIndex = tabIds.indexOf(activeDesktopTab);

    const filteredWindows = searchQuery
      ? (filterItems(windowList, searchQuery, 'window') as WindowInfo[])
      : null;
    const nextIndex = findNextIndex(tabIds.length, currentIndex, (i) => {
      if (!filteredWindows) return true;
      return filterWindowsByDesktopTab(filteredWindows, tabIds[i]).length > 0;
    });
    setActiveDesktopTab(tabIds[nextIndex]);
    setSelectedIndex(0);
  }

  async function handleKeyDown(e: React.KeyboardEvent): Promise<void> {
    // 2 つ以上を閉じる前の確認の帯: Enter で閉じる、Esc でやめる。ほかのキーは通常どおり
    const pendingClose = windowSelection.pendingClose;
    if (searchMode === 'window' && pendingClose && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      e.stopPropagation();
      windowSelection.setPendingClose(null);
      if (e.key === 'Enter') {
        await windowOps.closeWindows(pendingClose.filter((w) => !windowOps.isClosing(w.hwnd)));
      }
      return;
    }

    // Esc: 選択があれば外す（選択も確認の帯もないときの Esc はメインプロセスがウィンドウを隠す）
    if (searchMode === 'window' && e.key === 'Escape' && windowSelection.markedWindows.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      windowSelection.clear();
      return;
    }

    // Ctrl+Shift+A: 表示中のウィンドウをすべて選ぶ
    if (searchMode === 'window' && e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      e.stopPropagation();
      windowSelection.selectAll();
      return;
    }

    // Shift+↑↓: カーソルを動かしながら範囲を選ぶ（ウィンドウ検索モード。端で止まる）
    if (
      searchMode === 'window' &&
      e.shiftKey &&
      !e.ctrlKey &&
      (e.key === 'ArrowUp' || e.key === 'ArrowDown')
    ) {
      e.preventDefault();
      e.stopPropagation();
      if (filteredItems.length === 0) return;
      const next =
        e.key === 'ArrowDown'
          ? Math.min(filteredItems.length - 1, selectedIndex + 1)
          : Math.max(0, selectedIndex - 1);
      windowSelection.extendTo(next);
      setSelectedIndex(next);
      return;
    }

    // Shift+Tab: ウィンドウ検索モード切り替え
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      await toggleSearchMode();
      return;
    }

    // Tab: タブ切り替え（通常モードはデータファイルのタブ、ウィンドウ検索はデスクトップのタブ）
    if (e.key === 'Tab' && canSwitchTab()) {
      e.preventDefault();
      e.stopPropagation();
      switchToNextTab();
      return;
    }

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

      if (desktopCount < 2) return;
      // 固定中のウィンドウは全デスクトップに出るので動かさない
      const targets = windowTargets().filter((w) => !w.isPinned);
      const step = e.key === 'ArrowRight' ? 1 : -1;
      await windowOps.moveToDesktop(targets, (w) => {
        const to = (w.desktopNumber || 1) + step;
        return to >= 1 && to <= desktopCount ? to : null;
      });
      return;
    }

    // Ctrl+P: ウィンドウのピン留めトグル（ウィンドウモード時）
    if (searchMode === 'window' && e.ctrlKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      e.stopPropagation();

      if (!canPinWindow) {
        // 対象のウィンドウに関係なく出す知らせなので、アイテム名のないシンプルな形にする
        await window.electronAPI.showToastWindow({
          type: 'warning',
          message: t('launcher.messages.virtualDesktopUnsupported'),
        });
        return;
      }
      await windowOps.togglePinned(windowTargets());
      return;
    }

    // Ctrl+D: ウィンドウを閉じる（ウィンドウモード時）
    if (searchMode === 'window' && e.ctrlKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      e.stopPropagation();

      // 2 つ以上は確認の帯を出してから閉じる（Enter で閉じる・Esc でやめる）
      await windowSelection.requestClose(windowTargets(), windowOps.closeWindows);
      return;
    }

    const selectedItem = filteredItems[selectedIndex];

    // Shift+F10・アプリケーションキー: 選んでいる行の右クリックメニュー（検索欄の文字のメニューは出さない）
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      if (selectedItem) onOpenContextMenu?.(selectedIndex);
      return;
    }

    // Ctrl+C: パスをコピー、Ctrl+Shift+C: 親フォルダのパスをコピー（通常検索のとき）。
    // 検索欄で文字を選んでいるときの Ctrl+C は、今までどおり文字のコピー
    if (searchMode === 'normal' && e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'c') {
      const input = e.target as Partial<HTMLInputElement>;
      const hasTextSelection =
        typeof input.selectionStart === 'number' && input.selectionStart !== input.selectionEnd;
      if (!e.shiftKey && hasTextSelection) return;
      if (!selectedItem || !isLauncherItem(selectedItem) || selectedItem.type === 'windowSwitch') {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) await onCopyParentPath?.(selectedItem);
      else await onCopyPath?.(selectedItem);
      return;
    }

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        // 押しっぱなしのキーリピートでは実行しない（多重起動や、失敗のダイアログを閉じた直後の実行し直しを防ぐ）
        if (e.repeat || !selectedItem) return;
        // Ctrl+Shift+Enter: 管理者として実行（ウィンドウ検索の行は Enter と同じく前面に出す）
        if (e.ctrlKey && e.shiftKey && !isWindowInfo(selectedItem)) {
          await onRunAsAdmin?.(selectedItem);
          return;
        }
        if (e.shiftKey && isLauncherItem(selectedItem)) {
          // URL・カスタム URI・パスの無い単一アイテムには親フォルダが無い。押しても無反応だと故障に見えるので知らせる
          if (
            selectedItem.type === 'url' ||
            selectedItem.type === 'customUri' ||
            selectedItem.type === 'windowSwitch'
          ) {
            await window.electronAPI.showToastWindow({
              displayName: selectedItem.displayName,
              itemType: selectedItem.type,
              message: t('launcher.messages.noContainingFolder'),
            });
            return;
          }
          await window.electronAPI.openParentFolder(selectedItem as LauncherItem);
        } else if (e.shiftKey && !isWindowInfo(selectedItem)) {
          // セット・クリップボードにも親フォルダは無い。
          // Enter と同じく実行すると思わぬ起動になるので、実行せずに URL と同じ文言で知らせる
          //（セットのトーストは中身の一覧を出す形なので、名前を本文に入れたシンプルな形にする）
          await window.electronAPI.showToastWindow(
            selectedItem.type === 'set'
              ? {
                  type: 'info',
                  message: t('launcher.messages.noContainingFolderNamed', {
                    name: selectedItem.displayName,
                  }),
                }
              : {
                  displayName: selectedItem.displayName,
                  itemType: selectedItem.type,
                  message: t('launcher.messages.noContainingFolder'),
                }
          );
        } else {
          await handleExecuteItem(selectedItem);
        }
        return;

      case 'F2':
        if (searchMode !== 'normal' || !selectedItem) return;
        e.preventDefault();
        e.stopPropagation();
        handleEditItem(selectedItem);
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
          windowSelection.resetAnchor();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        }
        return;

      case 'ArrowDown':
        if (!e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          windowSelection.resetAnchor();
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

  return { handleKeyDown, switchToNextTab };
}
