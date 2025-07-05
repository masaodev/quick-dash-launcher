import React, { useState, useEffect, useRef } from 'react';
import { LauncherItem, RawDataLine } from '../common/types';
import SearchBox from './components/SearchBox';
import ItemList from './components/ItemList';
import TabControl from './components/TabControl';
import ActionButtons from './components/ActionButtons';
import RegisterModal, { RegisterItem } from './components/RegisterModal';
import EditModeView from './components/EditModeView';
import { parseDataFiles, filterItems } from './utils/dataParser';

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mainItems, setMainItems] = useState<LauncherItem[]>([]);
  const [tempItems, setTempItems] = useState<LauncherItem[]>([]);
  const [activeTab, setActiveTab] = useState<'main' | 'temp'>('main');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [droppedPaths, setDroppedPaths] = useState<string[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [rawLines, setRawLines] = useState<RawDataLine[]>([]);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadItems();
    
    window.electronAPI.onWindowShown(() => {
      setSearchQuery('');
      setSelectedIndex(0);
      searchInputRef.current?.focus();
    });

    // Load initial pin state
    const loadPinState = async () => {
      const pinState = await window.electronAPI.getWindowPinState();
      setIsPinned(pinState);
    };
    loadPinState();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

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
          console.log(`Got path for ${file.name}: ${filePath}`);
          if (filePath) {
            paths.push(filePath);
          }
        } catch (error) {
          console.error(`Error getting path for ${file.name}:`, error);
        }
      }
      
      console.log('Final paths:', paths);
      
      if (paths.length > 0) {
        setDroppedPaths(paths);
        setIsRegisterModalOpen(true);
      } else {
        alert('ファイルパスを取得できませんでした。\nファイルを直接エクスプローラーからドラッグしてください。');
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  useEffect(() => {
    if (isCtrlPressed) {
      setActiveTab(prev => prev === 'main' ? 'temp' : 'main');
    }
  }, [isCtrlPressed]);

  const loadItems = async () => {
    const dataFiles = await window.electronAPI.loadDataFiles();
    const { mainItems: main, tempItems: temp } = parseDataFiles(dataFiles);
    
    // Load cached icons
    const allItems = [...main, ...temp];
    const iconCache = await window.electronAPI.loadCachedIcons(allItems);
    
    // Apply cached icons to items
    const mainWithIcons = main.map(item => ({
      ...item,
      icon: iconCache[item.path] || item.icon
    }));
    
    const tempWithIcons = temp.map(item => ({
      ...item,
      icon: iconCache[item.path] || item.icon
    }));
    
    setMainItems(mainWithIcons);
    setTempItems(tempWithIcons);
  };

  const loadRawData = async () => {
    const rawData = await window.electronAPI.loadRawDataFiles();
    setRawLines(rawData);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedIndex(0);
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    const items = activeTab === 'main' ? mainItems : tempItems;
    const filteredItems = filterItems(items, searchQuery);

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
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredItems.length - 1
        );
        break;
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(prev => 
          prev < filteredItems.length - 1 ? prev + 1 : 0
        );
        break;
      case 'e':
        if (e.ctrlKey) {
          e.preventDefault();
          setIsEditMode(prev => !prev);
        }
        break;
    }
  };

  const handleItemClick = async (item: LauncherItem) => {
    await window.electronAPI.openItem(item);
  };

  const handleAddTemp = async () => {
    if (searchQuery.trim()) {
      const newItem: LauncherItem = {
        name: searchQuery,
        path: searchQuery,
        type: searchQuery.includes('://') ? 'url' : 'file'
      };
      
      const updatedItems = [...tempItems, newItem];
      setTempItems(updatedItems);
      
      const tempDataContent = updatedItems
        .map(item => `${item.name},${item.path}`)
        .join('\n');
      
      await window.electronAPI.saveTempData(tempDataContent);
      setSearchQuery('');
    }
  };

  const handleFetchFavicon = async () => {
    console.log('すべてのURLアイテムのファビコンを取得開始');
    
    // Function to fetch favicons for URL items
    const fetchFaviconsForItems = async (items: LauncherItem[]) => {
      const itemsWithFavicons = await Promise.all(
        items.map(async (item) => {
          if (item.type === 'url' && !item.icon) {
            try {
              console.log('ファビコン取得中:', item.path);
              const icon = await window.electronAPI.fetchFavicon(item.path);
              return { ...item, icon: icon || undefined };
            } catch (error) {
              console.error(`Failed to fetch favicon for ${item.path}:`, error);
              return item;
            }
          }
          return item;
        })
      );
      return itemsWithFavicons;
    };
    
    // Fetch favicons for both main and temp items
    const [mainWithFavicons, tempWithFavicons] = await Promise.all([
      fetchFaviconsForItems(mainItems),
      fetchFaviconsForItems(tempItems)
    ]);
    
    setMainItems(mainWithFavicons);
    setTempItems(tempWithFavicons);
    console.log('ファビコン取得完了');
  };


  const handleExtractAllIcons = async () => {
    // Load icons for all items
    const loadIconsForItems = async (items: LauncherItem[]) => {
      const itemsWithIcons = await Promise.all(
        items.map(async (item) => {
          if (!item.icon) {
            try {
              let icon: string | null = null;
              
              if (item.type === 'app' && item.path.endsWith('.exe')) {
                // Extract icon for Windows executables
                icon = await window.electronAPI.extractIcon(item.path);
              } else if (item.type === 'customUri') {
                // First try to extract icon from URI scheme handler
                icon = await window.electronAPI.extractCustomUriIcon(item.path);
                // If scheme handler icon failed, fall back to file extension
                if (!icon) {
                  icon = await window.electronAPI.extractFileIconByExtension(item.path);
                }
              } else if (item.type === 'file') {
                // Extract icon based on file extension
                icon = await window.electronAPI.extractFileIconByExtension(item.path);
              }
              // Skip URLs - favicons should only be fetched via the favicon button
              
              return { ...item, icon: icon || undefined };
            } catch (error) {
              console.error(`Failed to extract icon for ${item.path}:`, error);
              return item;
            }
          }
          return item;
        })
      );
      return itemsWithIcons;
    };
    
    // Load icons for both main and temp items
    const [mainWithIcons, tempWithIcons] = await Promise.all([
      loadIconsForItems(mainItems),
      loadIconsForItems(tempItems)
    ]);
    
    setMainItems(mainWithIcons);
    setTempItems(tempWithIcons);
  };

  const handleTogglePin = async () => {
    const newPinState = !isPinned;
    await window.electronAPI.setWindowPinState(newPinState);
    setIsPinned(newPinState);
  };

  const handleExportJson = () => {
    const exportData = {
      mainItems,
      tempItems,
      exportTimestamp: new Date().toISOString(),
      totalItems: mainItems.length + tempItems.length
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create a temporary element to copy to clipboard
    const textarea = document.createElement('textarea');
    textarea.value = jsonString;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    console.log('JSON data copied to clipboard:', exportData);
    alert('LauncherItemのJSONデータがクリップボードにコピーされました');
  };

  const handleSortDataFiles = async () => {
    try {
      await window.electronAPI.sortDataFiles();
      alert('データファイルをパスの昇順で並べ替えました。\nバックアップは backup フォルダに保存されています。');
      // Reload items to reflect the sorted data
      loadItems();
    } catch (error) {
      console.error('Error sorting data files:', error);
      alert('データファイルの並べ替え中にエラーが発生しました。');
    }
  };

  const handleRegisterItems = async (items: RegisterItem[]) => {
    await window.electronAPI.registerItems(items);
    loadItems(); // Reload items after registration
  };

  const handleToggleEditMode = async () => {
    if (!isEditMode) {
      // 編集モードに入る時は生データを読み込み
      await loadRawData();
    }
    setIsEditMode(prev => !prev);
    setSearchQuery(''); // Clear search when entering edit mode
    setSelectedIndex(0);
  };

  const handleItemUpdate = async (item: LauncherItem) => {
    try {
      await window.electronAPI.updateItem({
        sourceFile: item.sourceFile!,
        lineNumber: item.lineNumber!,
        newItem: item
      });
      await loadItems(); // Reload items after update
    } catch (error) {
      console.error('Error updating item:', error);
      alert('アイテムの更新中にエラーが発生しました。');
    }
  };

  const handleItemsDelete = async (items: LauncherItem[]) => {
    try {
      const deleteRequests = items.map(item => ({
        sourceFile: item.sourceFile!,
        lineNumber: item.lineNumber!
      }));
      await window.electronAPI.deleteItems(deleteRequests);
      await loadItems(); // Reload items after deletion
    } catch (error) {
      console.error('Error deleting items:', error);
      alert('アイテムの削除中にエラーが発生しました。');
    }
  };

  const handleBatchUpdate = async (items: LauncherItem[]) => {
    try {
      const updateRequests = items.map(item => ({
        sourceFile: item.sourceFile!,
        lineNumber: item.lineNumber!,
        newItem: item
      }));
      await window.electronAPI.batchUpdateItems(updateRequests);
      await loadItems(); // Reload items after batch update
    } catch (error) {
      console.error('Error batch updating items:', error);
      alert('アイテムの一括更新中にエラーが発生しました。');
    }
  };

  const handleRawDataSave = async (updatedRawLines: RawDataLine[]) => {
    try {
      await window.electronAPI.saveRawDataFiles(updatedRawLines);
      setRawLines(updatedRawLines);
      // 通常モードのデータも更新
      await loadItems();
    } catch (error) {
      console.error('Error saving raw data:', error);
      alert('データの保存中にエラーが発生しました。');
    }
  };

  const handleExitEditMode = () => {
    setIsEditMode(false);
    setSearchQuery('');
    setSelectedIndex(0);
  };

  const currentItems = activeTab === 'main' ? mainItems : tempItems;
  const filteredItems = filterItems(currentItems, searchQuery);

  return (
    <div className={`app ${isDraggingOver ? 'dragging-over' : ''} ${isEditMode ? 'edit-mode' : ''}`} onKeyDown={handleKeyDown}>
      {isEditMode ? (
        <EditModeView
          rawLines={rawLines}
          onRawDataSave={handleRawDataSave}
          onExitEditMode={handleExitEditMode}
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
        />
      ) : (
        <>
          <div className="header">
            <SearchBox
              ref={searchInputRef}
              value={searchQuery}
              onChange={handleSearch}
              onKeyDown={handleKeyDown}
            />
            <ActionButtons
              onFetchFavicon={handleFetchFavicon}
              onExtractAllIcons={handleExtractAllIcons}
              onAddTemp={handleAddTemp}
              onReload={loadItems}
              onOpenConfigFolder={() => window.electronAPI.openConfigFolder()}
              onOpenDataFile={() => window.electronAPI.openDataFile()}
              onTogglePin={handleTogglePin}
              onExportJson={handleExportJson}
              onSortDataFiles={handleSortDataFiles}
              onToggleEditMode={handleToggleEditMode}
              isPinned={isPinned}
              isEditMode={isEditMode}
            />
          </div>
          
          <TabControl activeTab={activeTab} onTabChange={setActiveTab} />
          
          <ItemList
            items={filteredItems}
            selectedIndex={selectedIndex}
            onItemClick={handleItemClick}
            onItemSelect={setSelectedIndex}
          />
          
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
              <div className="drag-message">
                ファイルをドロップして登録
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;