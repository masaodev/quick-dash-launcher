import React, { useState, useEffect, useRef } from 'react';

import { LauncherItem, GroupItem, AppItem, WindowPinMode, RawDataLine } from '../common/types';

import SearchBox from './components/SearchBox';
import ItemList from './components/ItemList';
import ActionButtons from './components/ActionButtons';
import RegisterModal, { RegisterItem } from './components/RegisterModal';
import IconProgressBar from './components/IconProgressBar';
import { FirstLaunchSetup } from './components/FirstLaunchSetup';
import { filterItems } from './utils/dataParser';
import { debugLog, debugInfo, logWarn } from './utils/debug';
import { useIconProgress } from './hooks/useIconProgress';
import { useSearchHistory } from './hooks/useSearchHistory';

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mainItems, setMainItems] = useState<AppItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [windowPinMode, setWindowPinMode] = useState<WindowPinMode>('normal');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [droppedPaths, setDroppedPaths] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<RawDataLine | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { progressState, resetProgress } = useIconProgress();
  const { navigateToPrevious, navigateToNext, resetNavigation, addHistoryEntry } =
    useSearchHistory();

  useEffect(() => {
    // 初回起動チェック: 設定ファイルの存在を確認
    const checkFirstLaunch = async () => {
      const isFirst = await window.electronAPI.isFirstLaunch();
      setIsFirstLaunch(isFirst);
    };
    checkFirstLaunch();

    loadItems();

    window.electronAPI.onWindowShown(() => {
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

    // Setup drag and drop event listeners
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      // Check if we have files
      if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) {
        return;
      }

      const paths: string[] = [];
      const files = e.dataTransfer.files;

      // Use webUtils.getPathForFile() through the preload API
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const filePath = window.electronAPI.getPathForFile(file);
          debugLog(`Got path for ${file.name}: ${filePath}`);
          if (filePath) {
            paths.push(filePath);
          }
        } catch (error) {
          console.error(`Error getting path for ${file.name}:`, error);
        }
      }

      debugLog('Final paths:', paths);

      if (paths.length > 0) {
        setDroppedPaths(paths);
        setIsRegisterModalOpen(true);
      } else {
        alert(
          'ファイルパスを取得できませんでした。\nファイルを直接エクスプローラーからドラッグしてください。'
        );
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    // データ変更通知のリスナーを設定
    window.electronAPI.onDataChanged(() => {
      debugLog('データ変更通知を受信、データを再読み込みします');
      loadItems();
    });

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
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

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    const filteredItems = filterItems(mainItems, searchQuery);

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
        e.stopPropagation();
        if (
          e.shiftKey &&
          filteredItems[selectedIndex] &&
          filteredItems[selectedIndex].type !== 'group'
        ) {
          await window.electronAPI.openParentFolder(filteredItems[selectedIndex] as LauncherItem);
        } else if (filteredItems[selectedIndex]) {
          // 検索クエリがある場合は履歴に追加（フロントエンド側で即座に）
          if (searchQuery.trim()) {
            await addHistoryEntry(searchQuery.trim());
          }
          // アイテムを実行（検索クエリはバックエンドに送らない）
          const item = filteredItems[selectedIndex];
          if (item.type === 'group') {
            await window.electronAPI.executeGroup(item as GroupItem, mainItems);
          } else {
            await window.electronAPI.openItem(item as LauncherItem);
          }
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
    }
  };

  const handleItemClick = async (item: LauncherItem) => {
    // 検索クエリがある場合は履歴に追加（フロントエンド側で即座に）
    if (searchQuery.trim()) {
      await addHistoryEntry(searchQuery.trim());
    }
    // アイテムを実行
    await window.electronAPI.openItem(item);
  };

  const handleGroupExecute = async (group: GroupItem) => {
    // 検索クエリがある場合は履歴に追加
    if (searchQuery.trim()) {
      await addHistoryEntry(searchQuery.trim());
    }
    // グループを実行
    await window.electronAPI.executeGroup(group, mainItems);
  };

  const handleRefreshAll = async () => {
    debugInfo('すべての更新を開始');

    // 1. データファイルの再読み込み
    const loadedItems = await loadItems();

    // 2. 統合プログレスAPIで全アイコン取得（強制）
    const allUrls = loadedItems
      .filter((item) => item.type === 'url')
      .map((item) => (item as LauncherItem).path);

    const allIconItems = loadedItems.filter(
      (item) => item.type !== 'url' && item.type !== 'group' && item.type !== 'folder'
    ) as LauncherItem[];

    if (allUrls.length > 0 || allIconItems.length > 0) {
      const results = await window.electronAPI.fetchIconsCombined(allUrls, allIconItems);

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

  const handleFetchMissingIcons = async () => {
    debugInfo('未取得アイコンの取得を開始');

    // 統合プログレスAPIを使用
    // URLアイテムの抽出（アイコン未設定のみ）
    const urls = mainItems
      .filter((item) => item.type === 'url' && !('icon' in item && item.icon))
      .map((item) => (item as LauncherItem).path);

    // EXE/ファイル/カスタムURIアイテムの抽出（アイコン未設定のみ、フォルダとグループを除外）
    const iconItems = mainItems.filter(
      (item) =>
        item.type !== 'url' &&
        item.type !== 'group' &&
        item.type !== 'folder' &&
        !('icon' in item && item.icon)
    ) as LauncherItem[];

    if (urls.length === 0 && iconItems.length === 0) {
      debugInfo('取得対象のアイテムがありません');
      return;
    }

    // 統合APIを呼び出し
    const results = await window.electronAPI.fetchIconsCombined(urls, iconItems);

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
    debugInfo('未取得アイコンの取得が完了');
  };

  const handleTogglePin = async () => {
    const newPinMode = await window.electronAPI.cycleWindowPinMode();
    setWindowPinMode(newPinMode);
  };

  const handleCopyPath = async (item: LauncherItem) => {
    try {
      // 引数がある場合は結合してコピー
      const fullCommand = item.args ? `${item.path} ${item.args}` : item.path;
      await window.electronAPI.copyToClipboard(fullCommand);
      logWarn(`パスをコピーしました: ${fullCommand}`);
    } catch (err) {
      console.error('パスのコピーに失敗しました:', err);
      alert('パスのコピーに失敗しました');
    }
  };

  const handleCopyParentPath = async (item: LauncherItem) => {
    try {
      let parentPath = '';

      // URL types don't have a parent path
      if (item.type === 'url' || item.type === 'customUri') {
        alert('URLおよびカスタムURIには親フォルダーがありません');
        return;
      }

      // Get parent directory path
      const path = item.path;
      const lastSlash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));

      if (lastSlash > 0) {
        parentPath = path.substring(0, lastSlash);
      } else {
        alert('親フォルダーのパスを取得できませんでした');
        return;
      }

      await window.electronAPI.copyToClipboard(parentPath);
      logWarn(`親フォルダーのパスをコピーしました: ${parentPath}`);
    } catch (err) {
      console.error('親フォルダーのパスのコピーに失敗しました:', err);
      alert('親フォルダーのパスのコピーに失敗しました');
    }
  };

  const handleCopyShortcutPath = async (item: LauncherItem) => {
    try {
      if (!item.originalPath) {
        alert('ショートカットのパスが見つかりません');
        return;
      }

      await window.electronAPI.copyToClipboard(item.originalPath);
      logWarn(`ショートカットのパスをコピーしました: ${item.originalPath}`);
    } catch (err) {
      console.error('ショートカットのパスのコピーに失敗しました:', err);
      alert('ショートカットのパスのコピーに失敗しました');
    }
  };

  const handleCopyShortcutParentPath = async (item: LauncherItem) => {
    try {
      if (!item.originalPath) {
        alert('ショートカットのパスが見つかりません');
        return;
      }

      // Get parent directory path of the shortcut file
      const path = item.originalPath;
      const lastSlash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));

      if (lastSlash > 0) {
        const parentPath = path.substring(0, lastSlash);
        await window.electronAPI.copyToClipboard(parentPath);
        logWarn(`ショートカットの親フォルダーのパスをコピーしました: ${parentPath}`);
      } else {
        alert('ショートカットの親フォルダーのパスを取得できませんでした');
      }
    } catch (err) {
      console.error('ショートカットの親フォルダーのパスのコピーに失敗しました:', err);
      alert('ショートカットの親フォルダーのパスのコピーに失敗しました');
    }
  };

  const handleOpenParentFolder = async (item: LauncherItem) => {
    try {
      await window.electronAPI.openParentFolder(item);
    } catch (err) {
      console.error('親フォルダーを開くのに失敗しました:', err);
      alert('親フォルダーを開くのに失敗しました');
    }
  };

  const handleRegisterItems = async (items: RegisterItem[]) => {
    if (editingItem && items.length === 1) {
      // 編集モードの場合
      const item = items[0];

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
    } else {
      // 新規登録モード
      await window.electronAPI.registerItems(items);
    }
    loadItems(); // Reload items after registration/update
  };

  const handleOpenBasicSettings = async () => {
    await window.electronAPI.openEditWindowWithTab('settings');
  };

  const handleOpenItemManagement = async () => {
    await window.electronAPI.openEditWindowWithTab('edit');
  };

  const handleOpenRegisterModal = () => {
    setEditingItem(null);
    setIsRegisterModalOpen(true);
  };

  const handleEditItem = async (item: LauncherItem) => {
    // LauncherItemからRawDataLineを構築
    const rawDataLine: RawDataLine = await convertLauncherItemToRawDataLine(item);
    setEditingItem(rawDataLine);
    setIsRegisterModalOpen(true);
  };

  const convertLauncherItemToRawDataLine = async (item: LauncherItem): Promise<RawDataLine> => {
    // フォルダ取込から展開されたアイテムの場合
    if (item.isDirExpanded && item.expandedFrom && item.lineNumber && item.sourceFile) {
      // 元のディレクティブ行を直接読み込む
      try {
        const rawLines = await window.electronAPI.loadRawDataFiles();
        const originalLine = rawLines.find(
          (line) => line.sourceFile === item.sourceFile && line.lineNumber === item.lineNumber
        );

        if (originalLine) {
          // 元の行が見つかった場合はそれを使用
          return originalLine;
        }
      } catch (err) {
        console.error('元のディレクティブ行の読み込みに失敗しました:', err);
      }

      // フォールバック: expandedOptionsを使用（ただし正確ではない可能性がある）
      let content = `dir,${item.expandedFrom}`;
      if (item.expandedOptions) {
        content += `,${item.expandedOptions}`;
      }

      return {
        lineNumber: item.lineNumber || 1,
        content: content,
        type: 'directive',
        sourceFile: item.sourceFile || 'data.txt',
        customIcon: undefined,
      };
    }

    // 通常のアイテムの場合
    const parts = [item.name, item.path];
    if (item.args) {
      parts.push(item.args);
    }
    if (item.customIcon) {
      // 引数がない場合は空文字を追加
      if (!item.args) {
        parts.push('');
      }
      parts.push(item.customIcon);
    }

    return {
      lineNumber: item.lineNumber || 1,
      content: parts.join(','),
      type: 'item',
      sourceFile: item.sourceFile || 'data.txt',
      customIcon: item.customIcon,
    };
  };

  const handleFirstLaunchComplete = async (hotkey: string) => {
    try {
      // ホットキーを設定（設定ファイルが自動的に作成される）
      await window.electronAPI.setMultipleSettings({
        hotkey,
      });
      await window.electronAPI.changeHotkey(hotkey);

      // 初回起動画面を閉じる
      setIsFirstLaunch(false);
    } catch (error) {
      console.error('初回設定の保存に失敗しました:', error);
      alert('設定の保存に失敗しました。');
    }
  };

  const filteredItems = filterItems(mainItems, searchQuery);

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
            onRefreshAll={handleRefreshAll}
            onTogglePin={handleTogglePin}
            onOpenBasicSettings={handleOpenBasicSettings}
            onOpenItemManagement={handleOpenItemManagement}
            onOpenRegisterModal={handleOpenRegisterModal}
            windowPinMode={windowPinMode}
            isEditMode={false}
          />
        </div>

        <ItemList
          items={filteredItems}
          allItems={mainItems}
          selectedIndex={selectedIndex}
          onItemClick={handleItemClick}
          onGroupExecute={handleGroupExecute}
          onItemSelect={setSelectedIndex}
          onCopyPath={handleCopyPath}
          onCopyParentPath={handleCopyParentPath}
          onOpenParentFolder={handleOpenParentFolder}
          onCopyShortcutPath={handleCopyShortcutPath}
          onCopyShortcutParentPath={handleCopyShortcutParentPath}
          onEditItem={handleEditItem}
        />

        {progressState.isActive && progressState.progress && (
          <IconProgressBar progress={progressState.progress} onClose={resetProgress} />
        )}

        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={() => {
            setIsRegisterModalOpen(false);
            setDroppedPaths([]);
            setEditingItem(null);
          }}
          onRegister={handleRegisterItems}
          droppedPaths={droppedPaths}
          editingItem={editingItem}
        />

        {isDraggingOver && (
          <div className="drag-overlay">
            <div className="drag-message">ファイルをドロップして登録</div>
          </div>
        )}
      </>
    </div>
  );
};

export default App;
