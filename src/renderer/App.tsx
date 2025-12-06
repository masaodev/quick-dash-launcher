import React, { useState, useEffect, useRef } from 'react';
import { convertLauncherItemToRawDataLine, type RegisterItem } from '@common/utils/dataConverters';

import { LauncherItem, GroupItem, AppItem, WindowPinMode, RawDataLine } from '../common/types';

import SearchBox from './components/SearchBox';
import ItemList from './components/ItemList';
import ActionButtons from './components/ActionButtons';
import RegisterModal from './components/RegisterModal';
import IconProgressBar from './components/IconProgressBar';
import FileTabBar from './components/FileTabBar';
import ItemCountDisplay from './components/ItemCountDisplay';
import { FirstLaunchSetup } from './components/FirstLaunchSetup';
import AlertDialog from './components/AlertDialog';
import ConfirmDialog from './components/ConfirmDialog';
import { filterItems } from './utils/dataParser';
import { debugLog } from './utils/debug';
import { useIconProgress } from './hooks/useIconProgress';
import { useSearchHistory } from './hooks/useSearchHistory';
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

  // handleExecuteItemを定義（useKeyboardShortcutsより前に必要）
  const handleExecuteItem = async (item: AppItem) => {
    // 検索クエリがある場合は履歴に追加
    if (searchQuery.trim()) {
      await addHistoryEntry(searchQuery.trim());
    }

    // グループかどうかで処理を分岐
    if (item.type === 'group') {
      await window.electronAPI.executeGroup(item as GroupItem, mainItems);
    } else {
      await window.electronAPI.openItem(item as LauncherItem);
    }
  };

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
    handleExecuteItem
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
    const launcherItems = items.filter((item) => item.type !== 'group') as LauncherItem[];
    const iconCache = await window.electronAPI.loadCachedIcons(launcherItems);

    // Apply cached icons to items
    const itemsWithIcons = items.map((item) => {
      if (item.type === 'group') {
        return item;
      }
      return {
        ...item,
        icon: iconCache[(item as LauncherItem).path] || ('icon' in item ? item.icon : undefined),
      };
    });

    setMainItems(itemsWithIcons);
    return itemsWithIcons;
  };

  const handleSearch = (query: string) => {
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
        } else {
          // 通常のアイテムの編集
          const newItem: LauncherItem = {
            name: item.name,
            path: item.path,
            type: item.type,
            args: item.args,
            customIcon: item.customIcon,
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
      console.error('Failed to delete item:', error);
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

  const handleOpenRegisterModal = () => {
    openRegisterModal();
  };

  const handleEditItem = async (item: AppItem) => {
    // グループアイテムの場合
    if (item.type === 'group') {
      const groupItem = item as GroupItem;
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

    // LauncherItemからRawDataLineを構築
    const rawDataLine: RawDataLine = await convertLauncherItemToRawDataLine(
      item as LauncherItem,
      window.electronAPI.loadRawDataFiles
    );
    openEditModal(rawDataLine);
  };

  const handleFirstLaunchComplete = async (hotkey: string) => {
    try {
      // ホットキーを設定（設定ファイルが自動的に作成される）
      // dataFileTabsも明示的に設定して、data.txtタブが含まれるようにする
      await window.electronAPI.setMultipleSettings({
        hotkey: hotkey,
        dataFileTabs: [{ files: ['data.txt'], name: 'メイン' }],
      });
      await window.electronAPI.changeHotkey(hotkey);

      // 初回起動画面を閉じる
      setIsFirstLaunch(false);
    } catch (error) {
      console.error('初回設定の保存に失敗しました:', error);
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
  const filteredItems = filterItems(tabFilteredItems, searchQuery);

  // 初回起動チェック中はローディング表示
  if (isFirstLaunch === null) {
    return <div className="app">読み込み中...</div>;
  }

  // 初回起動の場合は設定画面を表示
  if (isFirstLaunch) {
    return <FirstLaunchSetup onComplete={handleFirstLaunchComplete} />;
  }

  return (
    <div className={`app ${isDraggingOver ? 'dragging-over' : ''}`} onKeyDown={handleKeyDown}>
      <>
        <div className="header">
          <SearchBox
            ref={searchInputRef}
            value={searchQuery}
            onChange={handleSearch}
            onKeyDown={handleKeyDown}
          />
          <ActionButtons
            onReload={loadItems}
            onFetchMissingIcons={handleFetchMissingIcons}
            onFetchMissingIconsCurrentTab={handleFetchMissingIconsCurrentTab}
            onRefreshAll={handleRefreshAllWrapper}
            onTogglePin={handleTogglePin}
            onOpenBasicSettings={handleOpenBasicSettings}
            onOpenItemManagement={handleOpenItemManagement}
            onOpenRegisterModal={handleOpenRegisterModal}
            windowPinMode={windowPinMode}
            isEditMode={false}
          />
        </div>

        {showDataFileTabs && dataFileTabs.length > 1 && (
          <FileTabBar
            dataFileTabs={dataFileTabs}
            activeTab={activeTab}
            onTabClick={handleTabClickWrapper}
            allItems={mainItems}
            searchQuery={searchQuery}
          />
        )}

        {!showDataFileTabs && (
          <div className="search-info-bar">
            <ItemCountDisplay count={filteredItems.length} />
          </div>
        )}

        <ItemList
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
          <IconProgressBar progress={progressState.progress} onClose={resetProgress} />
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
