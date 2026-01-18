import React, { useState, useEffect, useRef } from 'react';
import { convertLauncherItemToRawDataLine } from '@common/utils/dataConverters';
import type { RegisterItem } from '@common/types';
import { escapeCSV } from '@common/utils/csvParser';
import {
  LauncherItem,
  AppItem,
  WindowPinMode,
  RawDataLine,
  SearchMode,
  WindowInfo,
  WindowOperationItem,
} from '@common/types';
import { isWindowInfo, isGroupItem, isWindowOperationItem } from '@common/types/guards';

import LauncherSearchBox from './components/LauncherSearchBox';
import LauncherItemList from './components/LauncherItemList';
import LauncherActionButtons from './components/LauncherActionButtons';
import RegisterModal from './components/RegisterModal';
import LauncherIconProgressBar from './components/LauncherIconProgressBar';
import LauncherFileTabBar from './components/LauncherFileTabBar';
import LauncherDesktopTabBar from './components/LauncherDesktopTabBar';
import LauncherItemCountDisplay from './components/LauncherItemCountDisplay';
import { SetupFirstLaunch } from './components/SetupFirstLaunch';
import AlertDialog from './components/AlertDialog';
import ConfirmDialog from './components/ConfirmDialog';
import { filterItems } from './utils/dataParser';
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
    item: RawDataLine | null;
  }>({
    isOpen: false,
    item: null,
  });

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

  // アイコン取得フック
  const { handleRefreshAll, handleFetchMissingIcons, handleFetchMissingIconsCurrentTab } =
    useIconFetcher(mainItems, setMainItems, showDataFileTabs, activeTab, dataFileTabs);

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
      setSearchQuery(''); // 検索クエリをクリア
    } else if (searchMode === 'window') {
      // ウィンドウ検索モード → 実行履歴検索モード
      setSearchMode('history');
      setWindowList([]);
      setDesktopInfo(null);
      setActiveDesktopTab(0);
      setSearchQuery(''); // 検索クエリをクリア
    } else {
      // 実行履歴検索モード → 通常モード
      setSearchMode('normal');
      setSearchQuery(''); // 検索クエリをクリア
    }
    setSelectedIndex(0); // 選択インデックスをリセット
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
          window.electronAPI.showToastWindow(`${windowItem.title} をアクティブ化しました`);
        }
      } else if (searchMode === 'history') {
        // 履歴モード：選択された履歴アイテムを直接実行
        if (isGroupItem(item)) {
          await window.electronAPI.executeGroup(item, mainItems);
          window.electronAPI.showToastWindow(
            `${item.name} (${item.itemNames.length}件) を起動しました`
          );
        } else if (isWindowOperationItem(item)) {
          await window.electronAPI.executeWindowOperation(item);
          window.electronAPI.showToastWindow(`${item.name} を実行しました`);
        } else {
          const launcherItem = item as LauncherItem;
          await window.electronAPI.openItem(launcherItem);
          window.electronAPI.showToastWindow(`${launcherItem.name} を起動しました`);
        }
      } else {
        // 通常モード（既存ロジック）
        // 検索クエリがある場合は履歴に追加
        if (searchQuery.trim()) {
          await addHistoryEntry(searchQuery.trim());
        }

        // アイテムの種類で処理を分岐
        if (isGroupItem(item)) {
          await window.electronAPI.executeGroup(item, mainItems);
          window.electronAPI.showToastWindow(
            `${item.name} (${item.itemNames.length}件) を起動しました`
          );
        } else if (isWindowOperationItem(item)) {
          await window.electronAPI.executeWindowOperation(item);
          window.electronAPI.showToastWindow(`${item.name} を実行しました`);
        } else {
          const launcherItem = item as LauncherItem;
          await window.electronAPI.openItem(launcherItem);
          window.electronAPI.showToastWindow(`${launcherItem.name} を起動しました`);

          // 実行履歴に追加
          await window.electronAPI.workspaceAPI.addExecutionHistory(launcherItem);

          // 実行履歴を再読み込み
          await loadExecutionHistory();
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
          type: 'windowOperation' as const,
          name: entry.itemName,
          windowTitle: windowTitle,
          x: entry.windowX,
          y: entry.windowY,
          width: entry.windowWidth,
          height: entry.windowHeight,
          virtualDesktopNumber: entry.virtualDesktopNumber,
          activateWindow: entry.activateWindow,
          sourceFile: 'history',
        } as WindowOperationItem;
      } else {
        return {
          name: entry.itemName,
          path: entry.itemPath,
          type: entry.itemType as 'url' | 'file' | 'folder' | 'app' | 'customUri',
          icon: entry.icon,
          args: entry.args,
          sourceFile: 'history',
        };
      }
    });

  // キーボードショートカットフック
  const { handleKeyDown } = useKeyboardShortcuts(
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
    handleToggleSearchMode
  );

  useEffect(() => {
    // 初回起動チェック: 設定ファイルの存在を確認
    const checkFirstLaunch = async () => {
      const isFirst = await window.electronAPI.isFirstLaunch();
      setIsFirstLaunch(isFirst);
    };
    checkFirstLaunch();

    loadItems();

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
      loadItems();
    });

    return () => {
      cleanupDataChanged();
    };
  }, []);

  const loadItems = async (): Promise<AppItem[]> => {
    const items = await window.electronAPI.loadDataFiles();

    // Load cached icons (LauncherItemのみ)
    const launcherItems = items.filter(
      (item) => !isWindowInfo(item) && !isGroupItem(item) && !isWindowOperationItem(item)
    ) as LauncherItem[];
    const iconCache = await window.electronAPI.loadCachedIcons(launcherItems);

    // Apply cached icons to items
    const itemsWithIcons = items.map((item) => {
      if (isWindowInfo(item) || isGroupItem(item) || isWindowOperationItem(item)) {
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
        await window.electronAPI.deleteItems([
          {
            sourceFile: editingItem.sourceFile,
            lineNumber: editingItem.lineNumber,
          },
        ]);
        await window.electronAPI.registerItems([item]);
      } else {
        // ファイルが変更されていない場合：従来の更新処理
        // フォルダ取込ディレクティブの編集の場合
        if (editingItem.type === 'directive' && item.itemCategory === 'dir') {
          // ディレクティブ形式でRawDataLineを更新
          let newContent = `dir,${item.path}`;
          if (item.dirOptions) {
            const opts = item.dirOptions;
            const optParts = [];
            optParts.push(`depth=${opts.depth}`);
            optParts.push(`types=${opts.types}`);
            if (opts.filter) optParts.push(`filter=${opts.filter}`);
            if (opts.exclude) optParts.push(`exclude=${opts.exclude}`);
            if (opts.prefix) optParts.push(`prefix=${opts.prefix}`);
            if (opts.suffix) optParts.push(`suffix=${opts.suffix}`);
            newContent += ',' + optParts.join(',');
          }

          // RawDataLineとして更新（editHandlersのupdateRawLineを使用する必要がある）
          await window.electronAPI.updateRawLine({
            sourceFile: editingItem.sourceFile,
            lineNumber: editingItem.lineNumber,
            newContent: newContent,
          });
        } else if (editingItem.type === 'directive' && item.itemCategory === 'group') {
          // グループアイテムの編集の場合
          const itemNames = item.groupItemNames || [];
          const newContent = `group,${item.name},${itemNames.join(',')}`;

          // RawDataLineとして更新
          await window.electronAPI.updateRawLine({
            sourceFile: editingItem.sourceFile,
            lineNumber: editingItem.lineNumber,
            newContent: newContent,
          });
        } else if (editingItem.type === 'directive' && item.itemCategory === 'window') {
          // ウィンドウ操作アイテムの編集の場合：window,{JSON形式の設定}
          const cfg = item.windowOperationConfig;
          if (!cfg) throw new Error('windowOperationConfig is required for window items');

          // JSON形式で設定を保存
          const config: Record<string, string | number | boolean> = {
            name: item.name,
            windowTitle: cfg.windowTitle,
          };

          // オプションフィールドは値がある場合のみ追加
          if (cfg.processName !== undefined) config.processName = cfg.processName;
          if (cfg.x !== undefined) config.x = cfg.x;
          if (cfg.y !== undefined) config.y = cfg.y;
          if (cfg.width !== undefined) config.width = cfg.width;
          if (cfg.height !== undefined) config.height = cfg.height;
          if (cfg.moveToActiveMonitorCenter !== undefined)
            config.moveToActiveMonitorCenter = cfg.moveToActiveMonitorCenter;
          if (cfg.virtualDesktopNumber !== undefined)
            config.virtualDesktopNumber = cfg.virtualDesktopNumber;
          if (cfg.activateWindow !== undefined) config.activateWindow = cfg.activateWindow;
          if (cfg.pinToAllDesktops !== undefined) config.pinToAllDesktops = cfg.pinToAllDesktops;

          const newContent = `window,${escapeCSV(JSON.stringify(config))}`;

          // RawDataLineとして更新
          await window.electronAPI.updateRawLine({
            sourceFile: editingItem.sourceFile,
            lineNumber: editingItem.lineNumber,
            newContent: newContent,
          });
        } else {
          // 通常のアイテムの編集
          const newItem: LauncherItem = {
            name: item.name,
            path: item.path,
            type: item.type,
            args: item.args,
            customIcon: item.customIcon,
            windowConfig: item.windowConfig,
          };

          await window.electronAPI.updateItem({
            sourceFile: editingItem.sourceFile,
            lineNumber: editingItem.lineNumber,
            newItem: newItem,
          });
        }
      }
    } else {
      // 新規登録モード
      await window.electronAPI.registerItems(items);
    }
    loadItems(); // Reload items after registration/update
  };

  // アイテム削除ハンドラー（RegisterModalから呼び出される）
  const handleDeleteItemFromModal = (item: RawDataLine) => {
    setDeleteConfirmDialog({
      isOpen: true,
      item: item,
    });
  };

  // 削除確認後の実行ハンドラー
  const handleConfirmDelete = async () => {
    const itemToDelete = deleteConfirmDialog.item;
    if (!itemToDelete) return;

    try {
      await window.electronAPI.deleteItems([
        {
          sourceFile: itemToDelete.sourceFile,
          lineNumber: itemToDelete.lineNumber,
        },
      ]);

      // モーダルを閉じる
      closeModal();

      // 削除ダイアログを閉じる
      setDeleteConfirmDialog({ isOpen: false, item: null });

      // データ再読み込み
      loadItems();
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
      const groupItem = item;
      const rawDataLine: RawDataLine = {
        lineNumber: groupItem.lineNumber || 1,
        content: `group,${groupItem.name},${groupItem.itemNames.join(',')}`,
        type: 'directive',
        sourceFile: groupItem.sourceFile || 'data.txt',
        customIcon: undefined,
      };
      openEditModal(rawDataLine);
      return;
    }

    // WindowOperationItemの場合
    if (isWindowOperationItem(item)) {
      const windowOp = item;

      // JSON形式で設定を構築
      const config: Record<string, string | number | boolean> = {
        name: windowOp.name,
        windowTitle: windowOp.windowTitle,
      };

      // オプションフィールドは値がある場合のみ追加
      if (windowOp.processName !== undefined) config.processName = windowOp.processName;
      if (windowOp.x !== undefined) config.x = windowOp.x;
      if (windowOp.y !== undefined) config.y = windowOp.y;
      if (windowOp.width !== undefined) config.width = windowOp.width;
      if (windowOp.height !== undefined) config.height = windowOp.height;
      if (windowOp.moveToActiveMonitorCenter !== undefined)
        config.moveToActiveMonitorCenter = windowOp.moveToActiveMonitorCenter;
      if (windowOp.virtualDesktopNumber !== undefined)
        config.virtualDesktopNumber = windowOp.virtualDesktopNumber;
      if (windowOp.activateWindow !== undefined) config.activateWindow = windowOp.activateWindow;
      if (windowOp.pinToAllDesktops !== undefined) config.pinToAllDesktops = windowOp.pinToAllDesktops;

      // JSON形式のコンテンツを作成
      const content = `window,${escapeCSV(JSON.stringify(config))}`;

      const rawDataLine: RawDataLine = {
        lineNumber: windowOp.lineNumber || 1,
        content: content,
        type: 'directive',
        sourceFile: windowOp.sourceFile || 'data.txt',
        customIcon: undefined,
      };
      openEditModal(rawDataLine);
      return;
    }

    // LauncherItemからRawDataLineを構築
    const rawDataLine: RawDataLine = await convertLauncherItemToRawDataLine(
      item as LauncherItem,
      window.electronAPI.loadRawDataFiles
    );
    openEditModal(rawDataLine);
  };

  const handleFirstLaunchComplete = async (hotkey: string, autoLaunch: boolean) => {
    try {
      // ホットキーを設定（設定ファイルが自動的に作成される）
      // dataFileTabsも明示的に設定して、data.txtタブが含まれるようにする
      await window.electronAPI.setMultipleSettings({
        hotkey: hotkey,
        autoLaunch: autoLaunch,
        dataFileTabs: [{ files: ['data.txt'], name: 'メイン' }],
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

  // ウィンドウ検索モード時のタブフィルタリング
  const getDesktopFilteredWindows = (windows: WindowInfo[]): WindowInfo[] => {
    if (activeDesktopTab === 0) {
      return windows; // すべて
    }
    if (activeDesktopTab === -1) {
      // 不明
      return windows.filter((w) => w.desktopNumber === undefined || w.desktopNumber === -1);
    }
    return windows.filter((w) => w.desktopNumber === activeDesktopTab);
  };

  const itemsToFilter =
    searchMode === 'window'
      ? getDesktopFilteredWindows(windowList)
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
      <>
        <div className="header">
          <LauncherSearchBox
            ref={searchInputRef}
            value={searchQuery}
            onChange={handleSearch}
            onKeyDown={handleKeyDown}
            searchMode={searchMode}
          />
          <LauncherActionButtons
            onReload={loadItems}
            onFetchMissingIcons={handleFetchMissingIcons}
            onFetchMissingIconsCurrentTab={handleFetchMissingIconsCurrentTab}
            onRefreshAll={handleRefreshAllWrapper}
            onTogglePin={handleTogglePin}
            onOpenBasicSettings={handleOpenBasicSettings}
            onOpenItemManagement={handleOpenItemManagement}
            onToggleWorkspace={handleToggleWorkspace}
            onOpenRegisterModal={handleOpenRegisterModal}
            windowPinMode={windowPinMode}
            isEditMode={false}
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

        {/* ウィンドウ検索モード用デスクトップタブ */}
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
        />

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
              ? `「${
                  deleteConfirmDialog.item.type === 'item'
                    ? deleteConfirmDialog.item.content.split(',')[0]
                    : deleteConfirmDialog.item.content
                }」を削除してもよろしいですか？`
              : ''
          }
          danger={true}
        />
      </>
    </div>
  );
};

export default App;
