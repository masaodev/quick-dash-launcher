import React, { useState, useEffect, useRef } from 'react';

import { LauncherItem, WindowPinMode } from '../common/types';

import SearchBox from './components/SearchBox';
import ItemList from './components/ItemList';
import ActionButtons from './components/ActionButtons';
import RegisterModal, { RegisterItem } from './components/RegisterModal';
import IconProgressBar from './components/IconProgressBar';
import { parseDataFiles, filterItems } from './utils/dataParser';
import { debugLog, debugInfo, logWarn } from './utils/debug';
import { useIconProgress } from './hooks/useIconProgress';

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mainItems, setMainItems] = useState<LauncherItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [windowPinMode, setWindowPinMode] = useState<WindowPinMode>('normal');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [droppedPaths, setDroppedPaths] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const { progressState } = useIconProgress();

  useEffect(() => {
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

  const loadItems = async () => {
    const dataFiles = await window.electronAPI.loadDataFiles();
    const { mainItems: main } = parseDataFiles(dataFiles);

    // Load cached icons
    const iconCache = await window.electronAPI.loadCachedIcons(main);

    // Apply cached icons to items
    const mainWithIcons = main.map((item) => ({
      ...item,
      icon: iconCache[item.path] || item.icon,
    }));

    setMainItems(mainWithIcons);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedIndex(0);
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    const filteredItems = filterItems(mainItems, searchQuery);

    switch (e.key) {
      case 'Enter':
        e.stopPropagation();
        if (e.shiftKey && filteredItems[selectedIndex]) {
          await window.electronAPI.openParentFolder(filteredItems[selectedIndex]);
        } else if (filteredItems[selectedIndex]) {
          await window.electronAPI.openItem(filteredItems[selectedIndex]);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
        break;
      case 'e':
        if (e.ctrlKey) {
          e.preventDefault();
          window.electronAPI.toggleEditWindow();
        }
        break;
    }
  };

  const handleItemClick = async (item: LauncherItem) => {
    await window.electronAPI.openItem(item);
  };

  const handleFetchFavicon = async (forceAll: boolean = false) => {
    debugInfo(
      forceAll
        ? 'すべてのURLアイテムのファビコンを強制取得開始'
        : 'アイコンなしURLアイテムのファビコンを取得開始'
    );

    // Extract URL items based on forceAll flag
    const allUrls = forceAll
      ? mainItems.filter((item) => item.type === 'url').map((item) => item.path)
      : mainItems.filter((item) => item.type === 'url' && !item.icon).map((item) => item.path);

    if (allUrls.length === 0) {
      debugInfo('取得対象のURLアイテムがありません');
      return;
    }

    // Use progress-enabled favicon fetching
    const results = await window.electronAPI.fetchFaviconsWithProgress(allUrls);

    // Apply fetched favicons to items
    const updateItemsWithFavicons = (items: LauncherItem[]) => {
      return items.map((item) => {
        if (item.type === 'url' && results[item.path]) {
          return { ...item, icon: results[item.path] || undefined };
        }
        return item;
      });
    };

    setMainItems(updateItemsWithFavicons(mainItems));
    debugInfo('ファビコン取得完了');
  };

  const handleExtractAllIcons = async (forceAll: boolean = false) => {
    debugInfo(
      forceAll
        ? 'すべてのアイテムのアイコンを強制抽出開始'
        : 'アイコンなしアイテムのアイコン抽出を開始'
    );

    // Extract items based on forceAll flag (excluding URLs)
    const allIconItems = forceAll
      ? mainItems.filter((item) => item.type !== 'url')
      : mainItems.filter((item) => !item.icon && item.type !== 'url');

    if (allIconItems.length === 0) {
      debugInfo('抽出対象のアイテムがありません');
      return;
    }

    // Use progress-enabled icon extraction
    const results = await window.electronAPI.extractIconsWithProgress(allIconItems);

    // Apply extracted icons to items
    const updateItemsWithIcons = (items: LauncherItem[]) => {
      return items.map((item) => {
        if (item.type !== 'url' && results[item.path]) {
          return { ...item, icon: results[item.path] || undefined };
        }
        return item;
      });
    };

    setMainItems(updateItemsWithIcons(mainItems));
    debugInfo('アイコン抽出完了');
  };

  const handleRefreshAll = async () => {
    debugInfo('すべての更新を開始');

    // 1. データファイルの再読み込み
    await loadItems();

    // 2. 全ファビコン強制取得
    await handleFetchFavicon(true);

    // 3. 全アイコン強制抽出
    await handleExtractAllIcons(true);

    debugInfo('すべての更新が完了');
  };

  const handleFetchMissingIcons = async () => {
    debugInfo('未取得アイコンの取得を開始');

    // ファビコン取得（未取得のみ）
    await handleFetchFavicon(false);

    // アイコン抽出（未取得のみ）
    await handleExtractAllIcons(false);

    debugInfo('未取得アイコンの取得が完了');
  };

  const handleTogglePin = async () => {
    const newPinMode = await window.electronAPI.cycleWindowPinMode();
    setWindowPinMode(newPinMode);
  };

  const handleExportJson = async () => {
    const exportData = {
      mainItems,
      exportTimestamp: new Date().toISOString(),
      totalItems: mainItems.length,
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    try {
      await window.electronAPI.copyToClipboard(jsonString);
      alert('LauncherItemのJSONデータがクリップボードにコピーされました');
    } catch (_err) {
      alert('クリップボードへのコピーに失敗しました');
    }
  };

  const handleCopyPath = async (item: LauncherItem) => {
    try {
      await window.electronAPI.copyToClipboard(item.path);
      logWarn(`パスをコピーしました: ${item.path}`);
    } catch (err) {
      console.error('パスのコピーに失敗しました:', err);
      alert('パスのコピーに失敗しました');
    }
  };

  const handleRegisterItems = async (items: RegisterItem[]) => {
    await window.electronAPI.registerItems(items);
    loadItems(); // Reload items after registration
  };

  const handleOpenBasicSettings = async () => {
    await window.electronAPI.openEditWindowWithTab('settings');
  };

  const handleOpenItemManagement = async () => {
    await window.electronAPI.openEditWindowWithTab('edit');
  };

  const filteredItems = filterItems(mainItems, searchQuery);

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
            onExportJson={handleExportJson}
            onOpenBasicSettings={handleOpenBasicSettings}
            onOpenItemManagement={handleOpenItemManagement}
            windowPinMode={windowPinMode}
            isEditMode={false}
          />
        </div>

        <ItemList
          items={filteredItems}
          selectedIndex={selectedIndex}
          onItemClick={handleItemClick}
          onItemSelect={setSelectedIndex}
          onCopyPath={handleCopyPath}
        />

        {progressState.isActive && progressState.progress && (
          <IconProgressBar progress={progressState.progress} />
        )}

        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={() => {
            setIsRegisterModalOpen(false);
            setDroppedPaths([]);
          }}
          onRegister={handleRegisterItems}
          droppedPaths={droppedPaths}
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
