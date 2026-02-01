import React, { useState, useEffect, useRef, useMemo } from 'react';
import type {
  RegisterItem,
  LauncherItem,
  AppItem,
  WindowPinMode,
  SearchMode,
  WindowInfo,
  WindowItem,
  IconFetchErrorRecord,
  EditingAppItem,
  EditableJsonItem,
} from '@common/types';
import { buildWindowOperationConfig } from '@common/utils/windowConfigUtils';
import { isWindowInfo, isGroupItem, isWindowItem } from '@common/types/guards';

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
import GlobalLoadingIndicator from './components/GlobalLoadingIndicator';
import { filterItems } from './utils/dataParser';
import { filterWindowsByDesktopTab } from './utils/windowFilter';
import { debugLog, logError } from './utils/debug';
import { useIconProgress } from './hooks/useIconProgress';
import { useSearchHistory } from './hooks/useSearchHistory';
import { useExecutionHistory } from './hooks/useExecutionHistory';
import { useRegisterModal } from './hooks/useRegisterModal';
import { useItemActions } from './hooks/useItemActions';
import { useDataFileTabs } from './hooks/useDataFileTabs';
import { useIconFetcher } from './hooks/useIconFetcher';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useGlobalLoading } from './hooks/useGlobalLoading';

const App: React.FC = () => {
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
  const { executionHistory, loadHistory: loadExecutionHistory } = useExecutionHistory();
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

  // タブ管理フック
  const {
    showDataFileTabs,
    dataFiles: _dataFiles,
    activeTab,
    dataFileTabs,
    dataFileLabels,
    setActiveTab,
    handleTabClick,
    getTabFilteredItems,
  } = useDataFileTabs();

  // ドラッグ&ドロップフック
  const { isDraggingOver } = useDragAndDrop(
    (paths: string[]) => openWithDroppedPaths(paths),
    (message: string) => {
      setAlertDialog({
        isOpen: true,
        message,
        type: 'error',
      });
    }
  );

  // アイコン取得エラー記録を読み込む関数
  const loadIconFetchErrors = async () => {
    const errors = await window.electronAPI.getIconFetchErrors();
    setIconFetchErrors(errors);
  };

  // アイコン取得フック
  const { handleRefreshAll, handleFetchMissingIcons, handleFetchMissingIconsCurrentTab } =
    useIconFetcher({
      mainItems,
      setMainItems,
      showDataFileTabs,
      activeTab,
      dataFileTabs,
      reloadIconFetchErrors: loadIconFetchErrors,
    });

  // グローバルローディングフック
  const { isLoading, message: loadingMessage, withLoading } = useGlobalLoading();

  // ウィンドウリストを更新する関数
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

  // データ読み込み関数
  const loadItems = async (): Promise<AppItem[]> => {
    const items = await window.electronAPI.loadDataFiles();

    // Load cached icons (LauncherItemのみ)
    const launcherItems = items.filter(
      (item) => !isWindowInfo(item) && !isGroupItem(item) && !isWindowItem(item)
    ) as LauncherItem[];
    const iconCache = await window.electronAPI.loadCachedIcons(launcherItems);

    // Apply cached icons to items
    const itemsWithIcons = items.map((item) => {
      if (isWindowInfo(item) || isGroupItem(item) || isWindowItem(item)) {
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

  // データ再読込ハンドラー（ローディング表示付き）
  const handleReloadItems = async (): Promise<void> => {
    await withLoading('データ再読込中', loadItems);
  };

  // 検索モード切り替えハンドラー（順次切り替え: normal → window → history → normal...）
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
    } else if (searchMode === 'window') {
      // ウィンドウ検索モード → 実行履歴検索モード
      setSearchMode('history');
      setWindowList([]);
      setDesktopInfo(null);
      setActiveDesktopTab(0);
    } else {
      // 実行履歴検索モード → 通常モード
      setSearchMode('normal');
    }
    setSelectedIndex(0); // 選択インデックスをリセット
  };

  // アイテム実行の共通処理（トースト表示 + 実行）
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
    } else {
      const launcherItem = item as LauncherItem;
      await window.electronAPI.showToastWindow({
        displayName: launcherItem.displayName,
        itemType: launcherItem.type,
        path: launcherItem.path,
        icon: launcherItem.icon,
      });
      await window.electronAPI.openItem(launcherItem);
    }
  };

  // handleExecuteItemを定義（useKeyboardShortcutsより前に必要）
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
          await window.electronAPI.showToastWindow(`${windowItem.title} をアクティブ化しました`);
        }
      } else if (searchMode === 'history') {
        // 履歴モード：選択された履歴アイテムを直接実行
        await executeAppItem(item);
      } else {
        // 通常モード
        // 検索クエリを事前保存（実行後にクリアされる可能性を考慮）
        const searchQueryForHistory = searchQuery.trim();

        // 即座にアイテム実行（トースト表示含む）
        await executeAppItem(item);

        // 実行後、バックグラウンドで履歴追加（並列化、fire-and-forget）
        // 検索履歴追加
        if (searchQueryForHistory) {
          addHistoryEntry(searchQueryForHistory).catch((error) => {
            console.error('検索履歴の追加に失敗しました:', error);
          });
        }

        // 実行履歴追加（LauncherItemのみ）
        if (!isGroupItem(item) && !isWindowItem(item)) {
          const launcherItem = item as LauncherItem;
          window.electronAPI.workspaceAPI
            .addExecutionHistory(launcherItem)
            .then(() => loadExecutionHistory())
            .catch((error) => {
              console.error('実行履歴の追加に失敗しました:', error);
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

  // 実行履歴エントリーをAppItem形式に変換（グループは除外）
  const historyItems: AppItem[] = executionHistory
    .filter((entry) => entry.itemType !== 'group')
    .map((entry) => {
      if (entry.itemType === 'windowOperation') {
        // [ウィンドウ操作: タイトル] から タイトル を抽出
        const match = entry.itemPath.match(/^\[ウィンドウ操作: (.+)\]$/);
        const windowTitle = match ? match[1] : entry.itemPath;
        return {
          type: 'window',
          displayName: entry.itemName,
          windowTitle: windowTitle,
          x: entry.windowX,
          y: entry.windowY,
          width: entry.windowWidth,
          height: entry.windowHeight,
          virtualDesktopNumber: entry.virtualDesktopNumber,
          activateWindow: entry.activateWindow,
          sourceFile: 'history',
        } as WindowItem;
      } else {
        return {
          displayName: entry.itemName,
          path: entry.itemPath,
          type: entry.itemType as 'url' | 'file' | 'folder' | 'app' | 'customUri',
          icon: entry.icon,
          args: entry.args,
          sourceFile: 'history',
        };
      }
    });

  // キーボードショートカットフック
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
    historyItems,
    toggleSearchMode: handleToggleSearchMode,
    refreshWindows: handleRefreshWindows,
    reloadData: handleReloadItems,
    desktopCount: desktopInfo?.desktopCount || 0,
    activeDesktopTab,
    setActiveDesktopTab,
  });

  useEffect(() => {
    // 初回起動チェック: 設定ファイルの存在を確認
    const checkFirstLaunch = async () => {
      const isFirst = await window.electronAPI.isFirstLaunch();
      setIsFirstLaunch(isFirst);
    };
    checkFirstLaunch();

    loadItems();

    // アイコン取得エラー記録を読み込み
    loadIconFetchErrors();

    window.electronAPI.onWindowShown((startTime) => {
      // パフォーマンス計測：レンダリング完了後に測定
      if (startTime !== undefined) {
        const logTiming = (label: string) => {
          const duration = Date.now() - startTime;
          window.electronAPI.logPerformanceTiming(label, duration);
        };

        logTiming('renderer-received');

        requestAnimationFrame(() => {
          logTiming('before-animation-frame');

          // 次のフレームで実際の描画完了を確認
          requestAnimationFrame(() => {
            logTiming('window-show-complete');
          });
        });
      }
      setSearchQuery('');
      setSelectedIndex(0);
      searchInputRef.current?.focus();
    });

    // ウィンドウ検索モードで表示された場合のリスナー
    window.electronAPI.onWindowShownItemSearch(async (startTime) => {
      // パフォーマンス計測
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
      // 検索モードをwindowに設定
      setSearchMode('window');
      // ウィンドウリストと仮想デスクトップ情報を取得
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
      // 検索クエリをクリア
      setSearchQuery('');
      setSelectedIndex(0);
      // 検索入力欄にフォーカス
      searchInputRef.current?.focus();
    });

    // ウィンドウが非表示になる際にリセット
    window.electronAPI.onWindowHidden(() => {
      setSearchQuery(''); // 検索テキストをクリア
      setSearchMode('normal'); // 通常モードに戻す
      setWindowList([]); // ウィンドウリストもクリア
    });

    // Load initial pin mode
    const loadPinState = async () => {
      const pinMode = await window.electronAPI.getWindowPinMode();
      setWindowPinMode(pinMode);
    };
    loadPinState();

    // データ変更通知のリスナーを設定
    const cleanupDataChanged = window.electronAPI.onDataChanged(async () => {
      debugLog('データ変更通知を受信、データを再読み込みします');
      await withLoading('データ再読込中', loadItems);
    });

    return () => {
      cleanupDataChanged();
    };
  }, []);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setSelectedIndex(0);
    // ユーザーが手動で入力を変更した場合は履歴ナビゲーションをリセット
    resetNavigation();
  };

  const handleTogglePin = async () => {
    const newPinMode = await window.electronAPI.cycleWindowPinMode();
    setWindowPinMode(newPinMode);
  };

  const handleRegisterItems = async (items: RegisterItem[]) => {
    if (editingItem && items.length === 1) {
      // 編集モードの場合
      const item = items[0];

      // 保存先ファイルが変更されたかチェック
      // targetFileが指定されている場合はそれを優先、なければtargetTabを使用
      const targetFile = item.targetFile || item.targetTab;
      const isFileChanged = targetFile !== editingItem.sourceFile;

      if (isFileChanged) {
        // ファイルが変更された場合：元のファイルから削除 + 新しいファイルに登録
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
        // ファイルが変更されていない場合：従来の更新処理
        // フォルダ取込ディレクティブの編集の場合（dirアイテム）
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
          // グループアイテムの編集の場合
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
          // ウィンドウ操作アイテムの編集の場合
          if (!editingItem.jsonItemId) {
            throw new Error('アイテムIDが見つかりません');
          }
          const cfg = item.windowOperationConfig;
          if (!cfg) throw new Error('windowOperationConfig is required for window items');

          // 共通ヘルパーを使用してJSON設定を構築
          const config = buildWindowOperationConfig({
            displayName: item.displayName,
            windowTitle: cfg.windowTitle,
            processName: cfg.processName,
            x: cfg.x,
            y: cfg.y,
            width: cfg.width,
            height: cfg.height,
            moveToActiveMonitorCenter: cfg.moveToActiveMonitorCenter,
            virtualDesktopNumber: cfg.virtualDesktopNumber,
            activateWindow: cfg.activateWindow,
            pinToAllDesktops: cfg.pinToAllDesktops,
          });

          await window.electronAPI.updateWindowItemById(editingItem.jsonItemId, config, item.memo);
        } else {
          // 通常のアイテムの編集
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
      // 新規登録モード
      await window.electronAPI.registerItems(items);
    }
    await withLoading('データ再読込中', loadItems); // Reload items after registration/update
  };

  // アイテム削除ハンドラー（RegisterModalから呼び出される）
  const handleDeleteItemFromModal = (item: EditingAppItem | EditableJsonItem) => {
    // EditableJsonItemの場合はEditingAppItemに変換する
    if ('item' in item && 'meta' in item) {
      // EditableJsonItem形式
      const editableItem = item as EditableJsonItem;
      // EditableJsonItemからEditingAppItemへの変換は行わず、
      // jsonItemIdを取得して直接削除処理に使用
      setDeleteConfirmDialog({
        isOpen: true,
        item: {
          ...editableItem.item,
          sourceFile: editableItem.meta.sourceFile,
          jsonItemId: editableItem.item.id,
        } as EditingAppItem,
      });
    } else {
      // EditingAppItem形式
      setDeleteConfirmDialog({
        isOpen: true,
        item: item as EditingAppItem,
      });
    }
  };

  // 削除確認後の実行ハンドラー
  const handleConfirmDelete = async () => {
    const itemToDelete = deleteConfirmDialog.item;
    if (!itemToDelete) return;

    try {
      if (!itemToDelete.jsonItemId) {
        throw new Error('アイテムIDが見つかりません');
      }
      await window.electronAPI.deleteItemsById([
        {
          id: itemToDelete.jsonItemId,
        },
      ]);

      // モーダルを閉じる
      closeModal();

      // 削除ダイアログを閉じる
      setDeleteConfirmDialog({ isOpen: false, item: null });

      // データ再読込
      await withLoading('データ再読込中', loadItems);
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

  const handleOpenRegisterModal = () => {
    openRegisterModal();
  };

  const handleEditItem = async (item: AppItem) => {
    // WindowInfoは編集不可
    if (isWindowInfo(item)) {
      return;
    }

    // グループアイテムの場合
    if (isGroupItem(item)) {
      openEditModal({
        ...item,
        sourceFile: item.sourceFile || 'data.json',
        jsonItemId: item.id ?? undefined,
      });
      return;
    }

    // WindowItemの場合
    if (isWindowItem(item)) {
      openEditModal({
        ...item,
        sourceFile: item.sourceFile || 'data.json',
        jsonItemId: item.id ?? undefined,
      });
      return;
    }

    // LauncherItemの場合
    const launcherItem = item as LauncherItem;
    // 展開されたアイテムの場合はexpandedFromIdを、そうでない場合はidを使用
    const jsonItemId = launcherItem.isDirExpanded ? launcherItem.expandedFromId : launcherItem.id;
    openEditModal({
      ...launcherItem,
      sourceFile: launcherItem.sourceFile || 'data.json',
      jsonItemId: jsonItemId ?? undefined,
    });
  };

  const handleFirstLaunchComplete = async (hotkey: string, autoLaunch: boolean) => {
    try {
      // ホットキーを設定（設定ファイルが自動的に作成される）
      // dataFileTabsも明示的に設定して、data.jsonタブが含まれるようにする
      await window.electronAPI.setMultipleSettings({
        hotkey: hotkey,
        autoLaunch: autoLaunch,
        dataFileTabs: [{ files: ['data.json'], name: 'メイン' }],
      });
      await window.electronAPI.changeHotkey(hotkey);

      // 初回起動画面を閉じる
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

  // handleRefreshAllのラッパー（loadItemsを渡す）
  const handleRefreshAllWrapper = () => handleRefreshAll(loadItems);

  // handleTabClickのラッパー（選択インデックスをリセット）
  const handleTabClickWrapper = (fileName: string) => {
    handleTabClick(fileName);
    setSelectedIndex(0);
  };

  const tabFilteredItems = getTabFilteredItems(mainItems);

  // エラー記録のキーセットを作成（検索を高速化）
  const errorKeySet = useMemo(() => {
    return new Set(iconFetchErrors.map((e) => e.key));
  }, [iconFetchErrors]);

  // アイコン未取得数を計算（LauncherItemのみ対象、フォルダ・エラー記録を除外）
  const missingIconCount = useMemo(() => {
    return mainItems.filter((item) => {
      // LauncherItemのみ対象（WindowInfo, GroupItem, WindowItemは除外）
      if (isWindowInfo(item) || isGroupItem(item) || isWindowItem(item)) {
        return false;
      }
      const launcherItem = item as LauncherItem;
      // フォルダとカスタムURIは除外（アイコン取得対象外）
      if (launcherItem.type === 'folder' || launcherItem.type === 'customUri') {
        return false;
      }
      // エラー記録にあるアイテムは除外
      if (errorKeySet.has(launcherItem.path)) {
        return false;
      }
      // アイコンが未取得のもの
      return !launcherItem.icon;
    }).length;
  }, [mainItems, errorKeySet]);

  const itemsToFilter =
    searchMode === 'window'
      ? filterWindowsByDesktopTab(windowList, activeDesktopTab)
      : searchMode === 'history'
        ? historyItems
        : tabFilteredItems;
  const filteredItems = filterItems(itemsToFilter, searchQuery, searchMode);

  // 初回起動チェック中はローディング表示
  if (isFirstLaunch === null) {
    return <div className="app">読み込み中...</div>;
  }

  // 初回起動の場合は設定画面を表示
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
          onRefreshAll={handleRefreshAllWrapper}
          onTogglePin={handleTogglePin}
          onOpenBasicSettings={handleOpenBasicSettings}
          onOpenItemManagement={handleOpenItemManagement}
          onToggleWorkspace={handleToggleWorkspace}
          onOpenRegisterModal={handleOpenRegisterModal}
          windowPinMode={windowPinMode}
        />
        <div className="drag-handle">⋮⋮</div>
      </div>

      {showDataFileTabs && searchMode === 'normal' && (
        <LauncherFileTabBar
          dataFileTabs={dataFileTabs}
          activeTab={activeTab}
          onTabClick={handleTabClickWrapper}
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
          onTabChange={(tabId) => {
            setActiveDesktopTab(tabId);
            setSelectedIndex(0);
          }}
        />
      )}

      <LauncherItemList
        items={filteredItems}
        allItems={mainItems}
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

      {searchMode === 'window' && (
        <div className="shortcut-hint">
          <span>
            <kbd>Ctrl</kbd>+<kbd>P</kbd> ピン留め/解除
          </span>
          {desktopInfo?.desktopCount && desktopInfo.desktopCount > 1 && activeDesktopTab > 0 && (
            <span>
              <kbd>Ctrl</kbd>+<kbd>←</kbd>/<kbd>→</kbd> 仮想デスクトップ移動
            </span>
          )}
        </div>
      )}

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

      <GlobalLoadingIndicator isLoading={isLoading} message={loadingMessage} />
    </div>
  );
};

export default App;
