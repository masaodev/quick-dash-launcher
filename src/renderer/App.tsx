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
    setMainItems(main);
    setTempItems(temp);
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
    
    if (selectedItem && selectedItem.type === 'url') {
      const favicon = await window.electronAPI.fetchFavicon(selectedItem.path);
      if (favicon) {
        selectedItem.icon = favicon;
        loadItems();
      }
    }
  };

  const handleExtractAllIcons = async () => {
    // TODO: Implement batch icon extraction
    console.log('Extract all icons');
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