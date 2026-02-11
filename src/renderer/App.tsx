import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DEFAULT_DATA_FILE } from '@common/types';
import type {
  RegisterItem,
  LauncherItem,
  AppItem,
  WindowPinMode,
  SearchMode,
  WindowInfo,
  IconFetchErrorRecord,
  EditingAppItem,
  EditableJsonItem,
} from '@common/types';
import {
  isWindowInfo,
  isGroupItem,
  isWindowItem,
  isClipboardItem,
  isLauncherItem,
} from '@common/types/guards';
import { summarizeImportResults } from '@common/utils/bookmarkImportUtils';

import LauncherSearchBox from './components/LauncherSearchBox';
import LauncherItemList from './components/LauncherItemList';
import LauncherActionButtons from './components/LauncherActionButtons';
import RegisterModal from './components/RegisterModal';
import LauncherIconProgressBar from './components/LauncherIconProgressBar';
import LauncherFileTabBar from './components/LauncherFileTabBar';
import LauncherDesktopTabBar from './components/LauncherDesktopTabBar';
import LauncherItemCountDisplay from './components/LauncherItemCountDisplay';
import MissingIconNotice from './components/MissingIconNotice';
import { SetupFirstLaunch } from './components/SetupFirstLaunch';
import AlertDialog from './components/AlertDialog';
import ConfirmDialog from './components/ConfirmDialog';
import { filterItems } from './utils/dataParser';
import { filterWindowsByDesktopTab } from './utils/windowFilter';
import { debugLog, logError } from './utils/debug';
import { useIconProgress } from './hooks/useIconProgress';
import { useSearchHistory } from './hooks/useSearchHistory';
import { useRegisterModal } from './hooks/useRegisterModal';
import { useItemActions } from './hooks/useItemActions';
import { useDataFileTabs } from './hooks/useDataFileTabs';
import { useIconFetcher } from './hooks/useIconFetcher';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
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

  // 削除確認ダイアログ状態管理
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    isOpen: boolean;
    item: EditingAppItem | null;
  }>({
    isOpen: false,
    item: null,
  });

  // アイコン取得エラー記録
  const [iconFetchErrors, setIconFetchErrors] = useState<IconFetchErrorRecord[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { progressState, resetProgress } = useIconProgress();
  const { navigateToPrevious, navigateToNext, resetNavigation, addHistoryEntry } =
    useSearchHistory();
  const {
    isRegisterModalOpen,
    droppedPaths,
    editingItem,
    openRegisterModal,
    openEditModal,
    openWithDroppedPaths,
    closeModal,
  } = useRegisterModal();
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

  const { isDraggingOver } = useDragAndDrop(
    (paths: string[]) => openWithDroppedPaths(paths),
    (message: string) => {
      setAlertDialog({
        isOpen: true,
        message,
        type: 'error',
      });
    },
    isRegisterModalOpen
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

  const handleRefreshWindows = async () => {
    if (searchMode !== 'window') return;

    await withLoading('ウィンドウ更新中', async () => {
      // ウィンドウリストと仮想デスクトップ情報を再取得
      const [windows, info] = await Promise.all([
        window.electronAPI.getAllWindowsAllDesktops(),
        window.electronAPI.getVirtualDesktopInfo(),
      ]);
      setWindowList(windows);
      setDesktopInfo(info);
      setSelectedIndex(0); // 選択インデックスをリセット
    });
  };

  const loadItems = async (): Promise<AppItem[]> => {
    const items = await window.electronAPI.loadDataFiles();

    // Load cached icons (LauncherItemのみ)
    const launcherItems = items.filter(
      (item) => !isWindowInfo(item) && !isGroupItem(item) && !isWindowItem(item)
    ) as LauncherItem[];
    const iconCache = await window.electronAPI.loadCachedIcons(launcherItems);

    // Apply cached icons to items
    const itemsWithIcons = items.map((item) => {
      if (isWindowInfo(item) || isGroupItem(item) || isWindowItem(item) || isClipboardItem(item)) {
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

  const executeAppItem = async (item: AppItem): Promise<void> => {
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
    } else if (isLauncherItem(item)) {
      await window.electronAPI.showToastWindow({
        displayName: item.displayName,
        itemType: item.type,
        path: item.path,
        icon: item.icon,
      });
      await window.electronAPI.openItem(item);
    }
  };

  const handleExecuteItem = async (item: AppItem) => {
    try {
      if (searchMode === 'window') {
        // ウィンドウモード
        const windowItem = item as WindowInfo;
        const result = await window.electronAPI.activateWindowByHwnd(windowItem.hwnd);

        if (!result.success) {
          setAlertDialog({
            isOpen: true,
            message: 'ウィンドウのアクティブ化に失敗しました',
            type: 'error',
          });
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
      setAlertDialog({
        isOpen: true,
        message: `アイテムの実行に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        type: 'error',
      });
    }
  };

  const { handleKeyDown } = useKeyboardShortcuts({
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
    toggleSearchMode: handleToggleSearchMode,
    refreshWindows: handleRefreshWindows,
    reloadData: handleReloadItems,
    desktopCount: desktopInfo?.desktopCount || 0,
    activeDesktopTab,
    setActiveDesktopTab,
  });

  useEffect(() => {
    const checkFirstLaunch = async () => {
      const isFirst = await window.electronAPI.isFirstLaunch();
      setIsFirstLaunch(isFirst);
    };
    checkFirstLaunch();

    loadItems();
    loadIconFetchErrors();

    window.electronAPI.onWindowShown((startTime) => {
      if (startTime !== undefined) {
        const logTiming = (label: string) => {
          const duration = Date.now() - startTime;
          window.electronAPI.logPerformanceTiming(label, duration);
        };

        logTiming('renderer-received');

        requestAnimationFrame(() => {
          logTiming('before-animation-frame');
          requestAnimationFrame(() => {
            logTiming('window-show-complete');
          });
        });
      }
      setSearchQuery('');
      setSelectedIndex(0);
      searchInputRef.current?.focus();
    });

    window.electronAPI.onWindowShownItemSearch(async (startTime) => {
      if (startTime !== undefined) {
        const logTiming = (label: string) => {
          const duration = Date.now() - startTime;
          window.electronAPI.logPerformanceTiming(label, duration);
        };

        logTiming('renderer-received-window-search');

        requestAnimationFrame(() => {
          logTiming('before-animation-frame-window-search');

          requestAnimationFrame(() => {
            logTiming('window-show-complete-window-search');
          });
        });
      }
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
    });

    window.electronAPI.onWindowHidden(() => {
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
      await withLoading('データ再読込中', loadItems);
    });

    return () => {
      cleanupDataChanged();
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

  const handleRegisterItems = async (items: RegisterItem[]) => {
    if (editingItem && items.length === 1) {
      const item = items[0];
      const targetFile = item.targetFile || item.targetTab;
      const isFileChanged = targetFile !== editingItem.sourceFile;

      if (isFileChanged) {
        if (!editingItem.jsonItemId) {
          throw new Error('アイテムIDが見つかりません');
        }
        await window.electronAPI.deleteItemsById([
          {
            id: editingItem.jsonItemId,
          },
        ]);
        await window.electronAPI.registerItems([item]);
      } else {
        if (item.itemCategory === 'dir') {
          if (!editingItem.jsonItemId) {
            throw new Error('アイテムIDが見つかりません');
          }
          await window.electronAPI.updateDirItemById(
            editingItem.jsonItemId,
            item.path,
            item.dirOptions,
            item.memo
          );
        } else if (item.itemCategory === 'group') {
          if (!editingItem.jsonItemId) {
            throw new Error('アイテムIDが見つかりません');
          }
          const itemNames = item.groupItemNames || [];
          await window.electronAPI.updateGroupItemById(
            editingItem.jsonItemId,
            item.displayName,
            itemNames,
            item.memo
          );
        } else if (item.itemCategory === 'window') {
          if (!editingItem.jsonItemId) {
            throw new Error('アイテムIDが見つかりません');
          }
          const cfg = item.windowOperationConfig;
          if (!cfg) throw new Error('windowOperationConfig is required for window items');

          const config = { ...cfg, displayName: item.displayName };
          await window.electronAPI.updateWindowItemById(editingItem.jsonItemId, config, item.memo);
        } else {
          if (!editingItem.jsonItemId) {
            throw new Error('アイテムIDが見つかりません');
          }

          const newItem: LauncherItem = {
            displayName: item.displayName,
            path: item.path,
            type: item.type,
            args: item.args,
            customIcon: item.customIcon,
            windowConfig: item.windowConfig,
            memo: item.memo,
          };

          await window.electronAPI.updateItemById({
            id: editingItem.jsonItemId,
            newItem: newItem,
          });
        }
      }
    } else {
      await window.electronAPI.registerItems(items);
    }
    await withLoading('データ再読込中', loadItems);

    if (editingItem) {
      showSuccess('アイテムを更新しました');
    } else {
      showSuccess('アイテムを登録しました');
    }
  };

  const handleDeleteItemFromModal = (item: EditingAppItem | EditableJsonItem) => {
    if ('item' in item && 'meta' in item) {
      const editableItem = item as EditableJsonItem;
      setDeleteConfirmDialog({
        isOpen: true,
        item: {
          ...editableItem.item,
          sourceFile: editableItem.meta.sourceFile,
          jsonItemId: editableItem.item.id,
        } as EditingAppItem,
      });
    } else {
      setDeleteConfirmDialog({
        isOpen: true,
        item: item as EditingAppItem,
      });
    }
  };

  const handleConfirmDelete = async () => {
    const itemToDelete = deleteConfirmDialog.item;
    if (!itemToDelete) return;

    try {
      if (!itemToDelete.jsonItemId) {
        throw new Error('アイテムIDが見つかりません');
      }
      await window.electronAPI.deleteItemsById([{ id: itemToDelete.jsonItemId }]);
      closeModal();
      setDeleteConfirmDialog({ isOpen: false, item: null });
      await withLoading('データ再読込中', loadItems);
      showSuccess('アイテムを削除しました');
    } catch (error) {
      logError('Failed to delete item:', error);
      setAlertDialog({
        isOpen: true,
        message: 'アイテムの削除に失敗しました。',
        type: 'error',
      });
      setDeleteConfirmDialog({ isOpen: false, item: null });
    }
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

  const handleEditItem = (item: AppItem) => {
    if (isWindowInfo(item)) return;

    if (isGroupItem(item) || isWindowItem(item)) {
      openEditModal({
        ...item,
        sourceFile: item.sourceFile || DEFAULT_DATA_FILE,
        jsonItemId: item.id ?? undefined,
      });
      return;
    }

    const launcherItem = item as LauncherItem;
    const jsonItemId = launcherItem.isDirExpanded ? launcherItem.expandedFromId : launcherItem.id;
    openEditModal({
      ...launcherItem,
      sourceFile: launcherItem.sourceFile || DEFAULT_DATA_FILE,
      jsonItemId: jsonItemId ?? undefined,
    });
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
    } catch (error) {
      logError('初回設定の保存に失敗しました:', error);
      setAlertDialog({
        isOpen: true,
        message: '設定の保存に失敗しました。',
        type: 'error',
      });
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
    await loadItems();
  };

  const handleRefreshAllWrapper = async () => {
    await window.electronAPI.bookmarkAutoImportAPI.executeAll();
    await handleRefreshAll(loadItems);
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

  const tabFilteredItems = getTabFilteredItems(mainItems);

  const errorKeySet = useMemo(() => new Set(iconFetchErrors.map((e) => e.key)), [iconFetchErrors]);

  const missingIconCount = useMemo(() => {
    return mainItems.filter((item) => {
      if (isWindowInfo(item) || isGroupItem(item) || isWindowItem(item) || isClipboardItem(item)) {
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

  const getItemsToFilter = (): AppItem[] => {
    switch (searchMode) {
      case 'window':
        return filterWindowsByDesktopTab(windowList, activeDesktopTab);
      default:
        return tabFilteredItems;
    }
  };
  const filteredItems = filterItems(getItemsToFilter(), searchQuery, searchMode);

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
          onOpenRegisterModal={openRegisterModal}
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

      {!showDataFileTabs && searchMode === 'normal' && (
        <div className="search-info-bar">
          <LauncherItemCountDisplay count={filteredItems.length} />
        </div>
      )}

      {searchMode === 'window' && desktopInfo?.supported && desktopInfo.desktopCount > 1 && (
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
        onRefreshWindows={handleRefreshWindows}
      />

      {/* eslint-disable no-irregular-whitespace */}
      {searchMode === 'window' && (
        <div className="shortcut-hint">
          {/* prettier-ignore */}
          <span>
            <strong>Ctrl+P</strong>:ピン留め/解除　<strong>Ctrl+D</strong>:ウィンドウを閉じる
            {desktopInfo?.desktopCount && desktopInfo.desktopCount > 1 && activeDesktopTab > 0 && (
              <>　<strong>Ctrl+←/→</strong>:仮想デスクトップ移動</>
            )}
          </span>
        </div>
      )}
      {/* eslint-enable no-irregular-whitespace */}

      {!progressState.isActive && missingIconCount > 0 && (
        <MissingIconNotice missingCount={missingIconCount} onFetchClick={handleFetchMissingIcons} />
      )}

      {progressState.isActive && progressState.progress && (
        <LauncherIconProgressBar progress={progressState.progress} onClose={resetProgress} />
      )}

      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={closeModal}
        onRegister={handleRegisterItems}
        droppedPaths={droppedPaths}
        editingItem={editingItem}
        currentTab={activeTab}
        onDelete={handleDeleteItemFromModal}
      />

      {isDraggingOver && (
        <div className="drag-overlay">
          <div className="drag-message">ファイルをドロップして登録</div>
        </div>
      )}

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        message={alertDialog.message}
        type={alertDialog.type}
      />

      <ConfirmDialog
        isOpen={deleteConfirmDialog.isOpen}
        onClose={() => setDeleteConfirmDialog({ isOpen: false, item: null })}
        onConfirm={handleConfirmDelete}
        message={
          deleteConfirmDialog.item
            ? `「${deleteConfirmDialog.item.displayName}」を削除してもよろしいですか？`
            : ''
        }
        danger={true}
      />
    </div>
  );
}

export default App;
