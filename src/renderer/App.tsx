/**
 * 画面: メインウィンドウ
 * 画面仕様: docs/screens/main-window.md
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DEFAULT_DATA_FILE } from '@common/types';
import type {
  LauncherItem,
  AppItem,
  WindowPinMode,
  SearchMode,
  WindowInfo,
  IconFetchErrorRecord,
} from '@common/types';
import {
  isWindowInfo,
  isGroupItem,
  isWindowItem,
  isClipboardItem,
  isLayoutItem,
  isLauncherItem,
} from '@common/types/guards';
import { summarizeImportResults } from '@common/utils/bookmarkImportUtils';

import LauncherSearchBox from './components/LauncherSearchBox';
import LauncherHintBar from './components/LauncherHintBar';
import LauncherItemList from './components/LauncherItemList';
import LauncherActionButtons from './components/LauncherActionButtons';
import LauncherIconProgressBar from './components/LauncherIconProgressBar';
import LauncherFileTabBar from './components/LauncherFileTabBar';
import LauncherDesktopTabBar from './components/LauncherDesktopTabBar';
import LauncherItemCountDisplay from './components/LauncherItemCountDisplay';
import MissingIconNotice from './components/MissingIconNotice';
import { SetupFirstLaunch } from './components/SetupFirstLaunch';
import AlertDialog from './components/AlertDialog';
import { filterItems } from './utils/dataParser';
import { filterWindowsByDesktopTab } from './utils/windowFilter';
import { debugLog, logError } from './utils/debug';
import { useIconProgress } from './hooks/useIconProgress';
import { useSearchHistory } from './hooks/useSearchHistory';
import { useRegisterWindow } from './hooks/useRegisterWindow';
import { useItemActions } from './hooks/useItemActions';
import { useDataFileTabs } from './hooks/useDataFileTabs';
import { useShowKeyboardHints } from './hooks/useShowKeyboardHints';
import { useIconFetcher } from './hooks/useIconFetcher';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWindowOperations } from './hooks/useWindowOperations';
import { useWindowMultiSelect } from './hooks/useWindowMultiSelect';
import { useGlobalLoading } from './hooks/useGlobalLoading';
import { useToast } from './hooks/useToast';

function App(): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [mainItems, setMainItems] = useState<AppItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [windowPinMode, setWindowPinMode] = useState<WindowPinMode>('normal');
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('normal');
  const [windowList, setWindowList] = useState<WindowInfo[]>([]);

  // 仮想デスクトップ関連の状態
  const [desktopInfo, setDesktopInfo] = useState<{
    supported: boolean;
    desktopCount: number;
    currentDesktop: number;
  } | null>(null);
  const [activeDesktopTab, setActiveDesktopTab] = useState<number>(0); // 0 = すべて

  // AlertDialog状態管理
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    message: string;
    type?: 'info' | 'error' | 'warning' | 'success';
  }>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const showErrorAlert = (message: string) => {
    setAlertDialog({ isOpen: true, message, type: 'error' });
  };

  // アイコン取得エラー記録
  const [iconFetchErrors, setIconFetchErrors] = useState<IconFetchErrorRecord[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { progressState, resetProgress } = useIconProgress();
  const { navigateToPrevious, navigateToNext, resetNavigation, addHistoryEntry } =
    useSearchHistory();
  // 登録・編集は独立した子ウィンドウで行う（メインウィンドウは動かさない）。保存先の初期値は今のタブ
  const activeTabRef = useRef<string | undefined>(undefined);
  const { isRegisterWindowOpen, openRegisterWindow, openEditWindow, openWithDroppedPaths } =
    useRegisterWindow(useCallback(() => activeTabRef.current, []));
  const {
    handleCopyPath,
    handleCopyParentPath,
    handleCopyShortcutPath,
    handleCopyShortcutParentPath,
    handleOpenParentFolder,
    handleOpenShortcutParentFolder,
  } = useItemActions();
  const { showSuccess, showWarning } = useToast();

  const {
    showDataFileTabs,
    activeTab,
    dataFileTabs,
    dataFileLabels,
    setActiveTab,
    handleTabClick,
    getTabFilteredItems,
  } = useDataFileTabs();
  activeTabRef.current = activeTab;
  const showKeyboardHints = useShowKeyboardHints();

  const { isDraggingOver } = useDragAndDrop(
    (paths: string[]) => openWithDroppedPaths(paths),
    showErrorAlert,
    isRegisterWindowOpen
  );

  const loadIconFetchErrors = useCallback(async () => {
    const errors = await window.electronAPI.getIconFetchErrors();
    setIconFetchErrors(errors);
  }, []);

  const { handleRefreshAll, handleFetchMissingIcons, handleFetchMissingIconsCurrentTab } =
    useIconFetcher({
      mainItems,
      setMainItems,
      showDataFileTabs,
      activeTab,
      dataFileTabs,
      reloadIconFetchErrors: loadIconFetchErrors,
    });

  const { withLoading } = useGlobalLoading();

  // ウィンドウリストの世代。取得中に新しい取得や削除があれば、古い取得結果は捨てる
  // （Ctrl+D の連打で、閉じる前に取得した一覧が後から届いて閉じたウィンドウが戻るのを防ぐ）
  const windowListVersionRef = useRef(0);

  // resetSelection: F5・リンクでの取り直しは選択を先頭に戻す。閉じる・固定・移動の後は位置を保つ
  //（Ctrl+D を続けたとき、先頭ではなく今の位置のウィンドウを閉じるように）
  const loadWindowList = useCallback(
    async (resetSelection: boolean) => {
      if (searchMode !== 'window') return;

      const version = ++windowListVersionRef.current;
      await withLoading('ウィンドウ更新中', async () => {
        // ウィンドウリストと仮想デスクトップ情報を再取得
        const [windows, info] = await Promise.all([
          window.electronAPI.getAllWindowsAllDesktops(),
          window.electronAPI.getVirtualDesktopInfo(),
        ]);
        if (version !== windowListVersionRef.current) return;
        setWindowList(windows);
        setDesktopInfo(info);
        if (resetSelection) setSelectedIndex(0);
      });
    },
    [searchMode, withLoading]
  );
  const handleRefreshWindows = useCallback(() => loadWindowList(true), [loadWindowList]);
  const refreshWindowsKeepingSelection = useCallback(() => loadWindowList(false), [loadWindowList]);

  /** 閉じたウィンドウを再取得を待たずに一覧から外す（連打したとき次の Ctrl+D が同じウィンドウを狙わないように） */
  const removeWindowFromList = useCallback((hwnd: WindowInfo['hwnd']) => {
    windowListVersionRef.current++;
    setWindowList((prev) => prev.filter((w) => w.hwnd !== hwnd));
  }, []);

  // trigger: 起動時と F5 は省略（explicit）。完全リフレッシュは 'full'（パスの種類も確かめ直す）。
  // アプリ内の操作に伴う再読込は 'internal'（先行の再読込があれば結果を共有する）
  const loadItems = async (trigger?: 'explicit' | 'full' | 'internal'): Promise<AppItem[]> => {
    const items = await window.electronAPI.loadDataFiles(trigger);

    // Load cached icons (LauncherItemのみ)
    const launcherItems = items.filter(
      (item) => !isWindowInfo(item) && !isGroupItem(item) && !isWindowItem(item)
    ) as LauncherItem[];
    const iconCache = await window.electronAPI.loadCachedIcons(launcherItems);

    // Apply cached icons to items
    const itemsWithIcons = items.map((item) => {
      if (
        isWindowInfo(item) ||
        isGroupItem(item) ||
        isWindowItem(item) ||
        isClipboardItem(item) ||
        isLayoutItem(item)
      ) {
        return item;
      }
      return {
        ...item,
        icon: iconCache[item.path] || item.icon,
      };
    });

    setMainItems(itemsWithIcons);
    return itemsWithIcons;
  };

  const handleReloadItems = async (): Promise<void> => {
    // F5 は「QDL 外で編集した設定ファイルを反映する」入口でもある。
    // settings.json の副作用（ホットキー等）を適用し直してからデータを読み直す
    await window.electronAPI.reapplySettings().catch((error) => {
      logError('設定の再適用に失敗しました:', error);
    });
    await withLoading('データ再読込中', loadItems);
  };

  const handleToggleSearchMode = async () => {
    if (searchMode === 'normal') {
      // 通常モード → ウィンドウ検索モード
      setSearchMode('window');
      // 全仮想デスクトップのウィンドウと仮想デスクトップ情報を取得
      const [windows, info] = await Promise.all([
        window.electronAPI.getAllWindowsAllDesktops(),
        window.electronAPI.getVirtualDesktopInfo(),
      ]);
      setWindowList(windows);
      setDesktopInfo(info);
      // 現在のデスクトップをデフォルトタブとして設定
      if (info.supported && info.currentDesktop > 0) {
        setActiveDesktopTab(info.currentDesktop);
      } else {
        setActiveDesktopTab(0);
      }
    } else {
      // ウィンドウ検索モード → 通常モード
      setSearchMode('normal');
      setWindowList([]);
      setDesktopInfo(null);
      setActiveDesktopTab(0);
    }
    setSelectedIndex(0); // 選択インデックスをリセット
  };

  const executeAppItem = useCallback(
    async (item: AppItem): Promise<void> => {
      if (isGroupItem(item)) {
        await window.electronAPI.showToastWindow({
          displayName: item.displayName,
          itemType: 'group',
          itemCount: item.itemNames.length,
          itemNames: item.itemNames.slice(0, 3),
        });
        await window.electronAPI.executeGroup(item, mainItems);
      } else if (isWindowItem(item)) {
        await window.electronAPI.showToastWindow({
          displayName: item.displayName,
          itemType: 'windowOperation',
        });
        await window.electronAPI.executeWindowOperation(item);
      } else if (isClipboardItem(item)) {
        await window.electronAPI.showToastWindow({
          displayName: item.displayName,
          itemType: 'clipboard',
        });
        await window.electronAPI.clipboardAPI.restore(item.clipboardDataRef);
      } else if (isLayoutItem(item)) {
        await window.electronAPI.showToastWindow({
          displayName: item.displayName,
          itemType: 'layout',
        });
        await window.electronAPI.executeLayout(item);
      } else if (isLauncherItem(item)) {
        await window.electronAPI.showToastWindow({
          displayName: item.displayName,
          itemType: item.type,
          path: item.path,
          icon: item.icon,
        });
        await window.electronAPI.openItem(item);
      }
    },
    [mainItems]
  );

  const handleExecuteItem = useCallback(
    async (item: AppItem) => {
      try {
        if (searchMode === 'window') {
          // ウィンドウモード
          const windowItem = item as WindowInfo;
          const result = await window.electronAPI.activateWindowByHwnd(windowItem.hwnd);

          if (!result.success) {
            showErrorAlert('ウィンドウのアクティブ化に失敗しました');
          } else {
            await window.electronAPI.showToastWindow({
              displayName: windowItem.title,
              itemType: 'windowActivate',
            });
          }
        } else {
          // 通常モード
          // 検索クエリを事前保存（実行後にクリアされる可能性を考慮）
          const searchQueryForHistory = searchQuery.trim();

          await executeAppItem(item);

          // バックグラウンドで履歴追加（fire-and-forget）
          if (searchQueryForHistory) {
            addHistoryEntry(searchQueryForHistory).catch((error) => {
              console.error('検索履歴の追加に失敗しました:', error);
            });
          }
        }
      } catch (error) {
        showErrorAlert(
          `アイテムの実行に失敗しました: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    [searchMode, searchQuery, executeAppItem, addHistoryEntry]
  );

  const tabFilteredItems = useMemo(
    () => getTabFilteredItems(mainItems),
    [getTabFilteredItems, mainItems]
  );

  // Ctrl+P でウィンドウを固定（全デスクトップに表示）してよいか。非対応と分かっているときだけ止める
  //（読み込み前は固定を試し、失敗すればそのトーストが出る）。ヒントは対応と分かってから出す
  const canPinWindow = desktopInfo?.supported !== false;

  // ウィンドウ検索モードで仮想デスクトップのタブを出すか（2 つ以上あるとき）
  const showDesktopTabs =
    searchMode === 'window' && !!desktopInfo?.supported && desktopInfo.desktopCount > 1;
  // 件数（n件）を出すか: 通常モードでタブ表示 OFF／ウィンドウ検索でデスクトップのタブが出ていない
  const showCountBar =
    (!showDataFileTabs && searchMode === 'normal') || (searchMode === 'window' && !showDesktopTabs);

  const filteredItems = useMemo(() => {
    const itemsToFilter =
      searchMode === 'window'
        ? filterWindowsByDesktopTab(windowList, activeDesktopTab)
        : tabFilteredItems;
    return filterItems(itemsToFilter, searchQuery, searchMode);
  }, [searchMode, windowList, activeDesktopTab, tabFilteredItems, searchQuery]);

  // 一覧が縮んで選択が範囲外になったら末尾に合わせる（末尾のウィンドウを閉じた後など）
  useEffect(() => {
    if (filteredItems.length > 0 && selectedIndex >= filteredItems.length) {
      setSelectedIndex(filteredItems.length - 1);
    }
  }, [filteredItems.length, selectedIndex]);

  const handleEditItem = useCallback(
    (item: AppItem) => {
      if (isWindowInfo(item)) return;

      if (isGroupItem(item) || isWindowItem(item)) {
        void openEditWindow({
          ...item,
          sourceFile: item.sourceFile || DEFAULT_DATA_FILE,
          jsonItemId: item.id ?? undefined,
        });
        return;
      }

      const launcherItem = item as LauncherItem;
      const jsonItemId = launcherItem.isDirExpanded ? launcherItem.expandedFromId : launcherItem.id;
      void openEditWindow({
        ...launcherItem,
        sourceFile: launcherItem.sourceFile || DEFAULT_DATA_FILE,
        jsonItemId: jsonItemId ?? undefined,
      });
    },
    [openEditWindow]
  );

  const windowOps = useWindowOperations({ removeWindowFromList, refreshWindowsKeepingSelection });
  const windowSelection = useWindowMultiSelect({ searchMode, filteredItems, selectedIndex });
  const markedCount = windowSelection.markedWindows.length;

  /** 右クリック（2 つ以上を選んでいるとき）の「閉じる」。キーの Ctrl+D と同じく確認の帯を出す */
  const handleMenuCloseMarked = () => {
    const targets = windowSelection.markedWindows;
    if (targets.length >= 2) windowSelection.setPendingClose(targets);
    else void windowOps.closeWindows(targets);
  };

  const { handleKeyDown: handleShortcutKeyDown } = useKeyboardShortcuts({
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
    toggleSearchMode: handleToggleSearchMode,
    refreshWindows: handleRefreshWindows,
    windowOps,
    windowSelection,
    reloadData: handleReloadItems,
    desktopCount: desktopInfo?.desktopCount || 0,
    canPinWindow,
    activeDesktopTab,
    setActiveDesktopTab,
  });

  // エラーのダイアログが出ているあいだは、キーをダイアログ（window の keydown で Enter・Esc を受ける）に任せる。
  // ここで Enter を処理すると止めてしまい、ダイアログに届かず選択中のアイテムをもう一度実行する
  const handleKeyDown = (e: React.KeyboardEvent): Promise<void> =>
    alertDialog.isOpen ? Promise.resolve() : handleShortcutKeyDown(e);

  // リストの行や余白（フォーカスを受け取らない要素）をクリックするとフォーカスが body に移り、
  // .app の onKeyDown にキーが届かなくなる。body に来たキーは検索欄にフォーカスを戻してから処理する
  //（文字キーも検索欄に入る）
  const handleKeyDownRef = useRef(handleKeyDown);
  handleKeyDownRef.current = handleKeyDown;
  useEffect(() => {
    const handleBodyKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body || !searchInputRef.current) return;
      searchInputRef.current.focus();
      void handleKeyDownRef.current(e as unknown as React.KeyboardEvent);
    };
    document.addEventListener('keydown', handleBodyKeyDown);
    return () => document.removeEventListener('keydown', handleBodyKeyDown);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([window.electronAPI.isFirstLaunch().then(setIsFirstLaunch), loadItems()]);
      window.electronAPI.notifyRendererReady();
    };

    initialize();
    loadIconFetchErrors();

    const logShowTimings = (startTime: number | undefined, suffix: string) => {
      if (startTime === undefined) return;
      const logTiming = (label: string) => {
        window.electronAPI.logPerformanceTiming(label, Date.now() - startTime);
      };
      logTiming(`renderer-received${suffix}`);
      requestAnimationFrame(() => {
        logTiming(`before-animation-frame${suffix}`);
        requestAnimationFrame(() => {
          logTiming(`window-show-complete${suffix}`);
        });
      });
    };

    const cleanupWindowShown = window.electronAPI.onWindowShown((startTime) => {
      logShowTimings(startTime, '');
      setSearchQuery('');
      setSelectedIndex(0);
      searchInputRef.current?.focus();
    });

    const cleanupWindowShownItemSearch = window.electronAPI.onWindowShownItemSearch(
      async (startTime) => {
        logShowTimings(startTime, '-window-search');
        setSearchMode('window');
        const [windows, info] = await Promise.all([
          window.electronAPI.getAllWindowsAllDesktops(),
          window.electronAPI.getVirtualDesktopInfo(),
        ]);
        setWindowList(windows);
        setDesktopInfo(info);
        setActiveDesktopTab(info.supported && info.currentDesktop > 0 ? info.currentDesktop : 0);
        setSearchQuery('');
        setSelectedIndex(0);
        searchInputRef.current?.focus();
      }
    );

    const cleanupWindowHidden = window.electronAPI.onWindowHidden(() => {
      setSearchQuery('');
      setSearchMode('normal');
      setWindowList([]);
    });

    const loadPinState = async () => {
      const pinMode = await window.electronAPI.getWindowPinMode();
      setWindowPinMode(pinMode);
    };
    loadPinState();

    const cleanupDataChanged = window.electronAPI.onDataChanged(async () => {
      debugLog('データ変更通知を受信、データを再読み込みします');
      await withLoading('データ再読込中', () => loadItems('internal'));
    });

    // 登録・編集ウィンドウ（子ウィンドウ）での結果。データ自体は data-changed で読み直す
    const cleanupChildResult = window.electronAPI.onMainChildWindowResult((result) => {
      if (result.kind !== 'register') return;
      const messages = {
        registered: 'アイテムを登録しました',
        updated: 'アイテムを更新しました',
        deleted: 'アイテムを削除しました',
      } as const;
      showSuccess(messages[result.action]);
    });

    return () => {
      cleanupWindowShown();
      cleanupWindowShownItemSearch();
      cleanupWindowHidden();
      cleanupDataChanged();
      cleanupChildResult();
    };
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedIndex(0);
    resetNavigation();
  };

  const handleTogglePin = async () => {
    const newPinMode = await window.electronAPI.cycleWindowPinMode();
    setWindowPinMode(newPinMode);
  };

  const handleOpenBasicSettings = async () => {
    await window.electronAPI.openEditWindowWithTab('settings');
  };

  const handleOpenItemManagement = async () => {
    await window.electronAPI.openEditWindowWithTab('edit');
  };

  const handleToggleWorkspace = async () => {
    await window.electronAPI.toggleWorkspaceWindow();
  };

  const handleFirstLaunchComplete = async (settings: {
    hotkey: string;
    autoLaunch: boolean;
    itemSearchHotkey: string;
  }) => {
    try {
      await window.electronAPI.setMultipleSettings({
        hotkey: settings.hotkey,
        autoLaunch: settings.autoLaunch,
        itemSearchHotkey: settings.itemSearchHotkey,
        dataFileTabs: [{ files: [DEFAULT_DATA_FILE], name: 'メイン' }],
      });
      await window.electronAPI.changeHotkey(settings.hotkey);
      if (settings.itemSearchHotkey) {
        await window.electronAPI.changeItemSearchHotkey(settings.itemSearchHotkey);
      }
      setIsFirstLaunch(false);
      // 初回のサンプルにはアイコンがまだ無いので、「取得」を押さなくても出るように取りに行く
      void handleFetchMissingIcons();
    } catch (error) {
      logError('初回設定の保存に失敗しました:', error);
      showErrorAlert('設定の保存に失敗しました。');
    }
  };

  const handleBookmarkAutoImport = async () => {
    const results = await window.electronAPI.bookmarkAutoImportAPI.executeAll();
    if (results.length === 0) {
      showWarning('有効なブックマーク取込ルールがありません');
      return;
    }
    const { message, hasError } = summarizeImportResults(results);
    if (hasError) {
      showWarning(message);
    } else {
      showSuccess(message);
    }
    await loadItems('internal');
  };

  const handleRefreshAllWrapper = async () => {
    await window.electronAPI.bookmarkAutoImportAPI.executeAll();
    await handleRefreshAll(() => loadItems('full'));
  };

  const handleTabRename = async (tabIndex: number, newName: string) => {
    const updatedTabs = dataFileTabs.map((tab, i) =>
      i === tabIndex ? { ...tab, name: newName } : tab
    );
    await window.electronAPI.setMultipleSettings({ dataFileTabs: updatedTabs });
  };

  const handleTabClickWrapper = (fileName: string) => {
    handleTabClick(fileName);
    setSelectedIndex(0);
  };

  const errorKeySet = useMemo(() => new Set(iconFetchErrors.map((e) => e.key)), [iconFetchErrors]);

  const missingIconCount = useMemo(() => {
    return mainItems.filter((item) => {
      if (
        isWindowInfo(item) ||
        isGroupItem(item) ||
        isWindowItem(item) ||
        isClipboardItem(item) ||
        isLayoutItem(item)
      ) {
        return false;
      }
      const launcherItem = item as LauncherItem;
      if (launcherItem.type === 'folder' || launcherItem.type === 'customUri') {
        return false;
      }
      if (errorKeySet.has(launcherItem.path)) {
        return false;
      }
      return !launcherItem.icon;
    }).length;
  }, [mainItems, errorKeySet]);

  if (isFirstLaunch === null) {
    return <div className="app">読み込み中...</div>;
  }

  if (isFirstLaunch) {
    return <SetupFirstLaunch onComplete={handleFirstLaunchComplete} />;
  }

  return (
    <div className={`app ${isDraggingOver ? 'dragging-over' : ''}`} onKeyDown={handleKeyDown}>
      <div className="header">
        <LauncherSearchBox
          ref={searchInputRef}
          value={searchQuery}
          onChange={handleSearch}
          onKeyDown={handleKeyDown}
          searchMode={searchMode}
          onToggleSearchMode={handleToggleSearchMode}
          onRefreshWindows={handleRefreshWindows}
          onReloadData={handleReloadItems}
        />
        <LauncherActionButtons
          onReload={handleReloadItems}
          onFetchMissingIcons={handleFetchMissingIcons}
          onFetchMissingIconsCurrentTab={handleFetchMissingIconsCurrentTab}
          onBookmarkAutoImport={handleBookmarkAutoImport}
          onRefreshAll={handleRefreshAllWrapper}
          onTogglePin={handleTogglePin}
          onOpenBasicSettings={handleOpenBasicSettings}
          onOpenItemManagement={handleOpenItemManagement}
          onToggleWorkspace={handleToggleWorkspace}
          onOpenRegisterModal={() => void openRegisterWindow()}
          windowPinMode={windowPinMode}
        />
        <div className="drag-handle">⋮⋮</div>
      </div>

      {showDataFileTabs && searchMode === 'normal' && (
        <LauncherFileTabBar
          dataFileTabs={dataFileTabs}
          activeTab={activeTab}
          onTabClick={handleTabClickWrapper}
          onTabRename={handleTabRename}
          allItems={mainItems}
          searchQuery={searchQuery}
          dataFileLabels={dataFileLabels}
        />
      )}

      {(showCountBar || markedCount > 0) && (
        <div className="search-info-bar">
          {showCountBar && <LauncherItemCountDisplay count={filteredItems.length} />}
          {markedCount > 0 && (
            <span className="selection-badge" data-testid="window-selection-badge">
              {markedCount} 件を選択中
            </span>
          )}
        </div>
      )}

      {showDesktopTabs && desktopInfo && (
        <LauncherDesktopTabBar
          desktopInfo={desktopInfo}
          activeDesktopTab={activeDesktopTab}
          windowList={windowList}
          searchQuery={searchQuery}
          onTabChange={(tabId) => {
            setActiveDesktopTab(tabId);
            setSelectedIndex(0);
          }}
        />
      )}

      <LauncherItemList
        items={filteredItems}
        selectedIndex={selectedIndex}
        onItemExecute={handleExecuteItem}
        onItemSelect={setSelectedIndex}
        onCopyPath={handleCopyPath}
        onCopyParentPath={handleCopyParentPath}
        onOpenParentFolder={handleOpenParentFolder}
        onCopyShortcutPath={handleCopyShortcutPath}
        onCopyShortcutParentPath={handleCopyShortcutParentPath}
        onOpenShortcutParentFolder={handleOpenShortcutParentFolder}
        onEditItem={handleEditItem}
        onCloseWindow={async (win) => {
          await windowOps.closeWindows([win]);
        }}
        onPinWindows={windowOps.togglePinned}
        onMoveWindows={(wins, desktopNumber) => windowOps.moveToDesktop(wins, desktopNumber)}
        windowSelection={{
          isMarked: windowSelection.isMarked,
          markedCount,
          toggle: windowSelection.toggle,
          selectRangeTo: windowSelection.selectRangeTo,
          onMenuClose: handleMenuCloseMarked,
          onMenuPin: (pin) => void windowOps.togglePinned(windowSelection.markedWindows, pin),
          onMenuMove: (desktopNumber) =>
            void windowOps.moveToDesktop(windowSelection.markedWindows, desktopNumber),
        }}
      />

      {searchMode === 'window' && windowSelection.pendingClose && (
        <div className="window-close-confirm" role="alert" data-testid="window-close-confirm">
          <span>{windowSelection.pendingClose.length} 個のウィンドウを閉じます</span>
          <span>
            <strong>Enter</strong>:閉じる{'　'}
            <strong>Esc</strong>:やめる
          </span>
        </div>
      )}

      {!progressState.isActive && missingIconCount > 0 && (
        <MissingIconNotice missingCount={missingIconCount} onFetchClick={handleFetchMissingIcons} />
      )}

      {progressState.isActive && progressState.progress && (
        <LauncherIconProgressBar progress={progressState.progress} onClose={resetProgress} />
      )}

      {showKeyboardHints && (
        <LauncherHintBar
          searchMode={searchMode}
          canSwitchDataFileTab={showDataFileTabs && dataFileTabs.length > 1}
          markedCount={markedCount}
          canPinWindow={desktopInfo?.supported === true}
          canMoveToDesktop={
            !!desktopInfo?.desktopCount && desktopInfo.desktopCount > 1 && activeDesktopTab > 0
          }
        />
      )}

      {isDraggingOver && (
        <div className="drag-overlay">
          <div className="drag-message">ファイル / URLをドロップして登録</div>
        </div>
      )}

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        message={alertDialog.message}
        type={alertDialog.type}
      />
    </div>
  );
}

export default App;
