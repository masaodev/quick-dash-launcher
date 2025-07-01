import React, { useState, useEffect, useRef } from 'react';
import { LauncherItem } from '../common/types';
import SearchBox from './components/SearchBox';
import ItemList from './components/ItemList';
import TabControl from './components/TabControl';
import ActionButtons from './components/ActionButtons';
import { parseDataFiles, filterItems } from './utils/dataParser';

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mainItems, setMainItems] = useState<LauncherItem[]>([]);
  const [tempItems, setTempItems] = useState<LauncherItem[]>([]);
  const [activeTab, setActiveTab] = useState<'main' | 'temp'>('main');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadItems();
    
    window.electronAPI.onWindowShown(() => {
      setSearchQuery('');
      setSelectedIndex(0);
      searchInputRef.current?.focus();
    });

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

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
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
    const items = activeTab === 'main' ? mainItems : tempItems;
    const filteredItems = filterItems(items, searchQuery);
    const selectedItem = filteredItems[selectedIndex];
    
    if (selectedItem) {
      let icon: string | null = null;
      
      if (selectedItem.type === 'url') {
        // Fetch favicon for URLs
        icon = await window.electronAPI.fetchFavicon(selectedItem.path);
      } else if (selectedItem.type === 'app' && selectedItem.path.endsWith('.exe')) {
        // Extract icon for Windows executables
        icon = await window.electronAPI.extractIcon(selectedItem.path);
      }
      
      if (icon) {
        // Update the icon in the current items list
        const updateItems = activeTab === 'main' ? setMainItems : setTempItems;
        const currentItemsList = activeTab === 'main' ? mainItems : tempItems;
        
        updateItems(currentItemsList.map(item => 
          item.path === selectedItem.path ? { ...item, icon } : item
        ));
      }
    }
  };

  const handleExtractAllIcons = async () => {
    // Load icons for all items
    const loadIconsForItems = async (items: LauncherItem[]) => {
      const itemsWithIcons = await Promise.all(
        items.map(async (item) => {
          if (!item.icon) {
            if (item.type === 'url') {
              // Fetch favicon for URLs
              try {
                const icon = await window.electronAPI.fetchFavicon(item.path);
                return { ...item, icon: icon || undefined };
              } catch (error) {
                console.error(`Failed to fetch favicon for ${item.path}:`, error);
                return item;
              }
            } else if (item.type === 'app' && item.path.endsWith('.exe')) {
              // Extract icon for Windows executables
              try {
                const icon = await window.electronAPI.extractIcon(item.path);
                return { ...item, icon: icon || undefined };
              } catch (error) {
                console.error(`Failed to extract icon for ${item.path}:`, error);
                return item;
              }
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

  const currentItems = activeTab === 'main' ? mainItems : tempItems;
  const filteredItems = filterItems(currentItems, searchQuery);

  return (
    <div className="app" onKeyDown={handleKeyDown}>
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
        />
      </div>
      
      <TabControl activeTab={activeTab} onTabChange={setActiveTab} />
      
      <ItemList
        items={filteredItems}
        selectedIndex={selectedIndex}
        onItemClick={handleItemClick}
        onItemSelect={setSelectedIndex}
      />
    </div>
  );
};

export default App;