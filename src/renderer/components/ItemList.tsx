import React, { useEffect, useRef, useState } from 'react';

import { LauncherItem } from '../../common/types';

import ContextMenu from './ContextMenu';

interface ItemListProps {
  items: LauncherItem[];
  selectedIndex: number;
  onItemClick: (item: LauncherItem) => void;
  onItemSelect: (index: number) => void;
  onCopyPath?: (item: LauncherItem) => void;
  onCopyParentPath?: (item: LauncherItem) => void;
  onCopyShortcutPath?: (item: LauncherItem) => void;
  onCopyShortcutParentPath?: (item: LauncherItem) => void;
}

const ItemList: React.FC<ItemListProps> = ({
  items,
  selectedIndex,
  onItemClick,
  onItemSelect,
  onCopyPath,
  onCopyParentPath,
  onCopyShortcutPath,
  onCopyShortcutParentPath,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    position: { x: number; y: number };
    item: LauncherItem | null;
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    item: null,
  });

  useEffect(() => {
    // Scroll selected item into view
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  const getDefaultIcon = (item: LauncherItem) => {
    switch (item.type) {
      case 'url':
        return '🌐';
      case 'folder':
        return '📁';
      case 'app':
        return '⚙️';
      case 'file':
        return '📄';
      case 'customUri':
        return '🔗';
      default:
        return '❓';
    }
  };

  const getFullPath = (item: LauncherItem): string => {
    // pathとargsを結合して完全なコマンドラインを返す
    if (item.args) {
      return `${item.path} ${item.args}`;
    }
    return item.path;
  };

  const handleContextMenu = (event: React.MouseEvent, item: LauncherItem) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      isVisible: true,
      position: { x: event.clientX, y: event.clientY },
      item: item,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({
      isVisible: false,
      position: { x: 0, y: 0 },
      item: null,
    });
  };

  const handleCopyPath = (item: LauncherItem) => {
    if (onCopyPath) {
      onCopyPath(item);
    }
  };

  const handleCopyParentPath = (item: LauncherItem) => {
    if (onCopyParentPath) {
      onCopyParentPath(item);
    }
  };

  const handleCopyShortcutPath = (item: LauncherItem) => {
    if (onCopyShortcutPath) {
      onCopyShortcutPath(item);
    }
  };

  const handleCopyShortcutParentPath = (item: LauncherItem) => {
    if (onCopyShortcutParentPath) {
      onCopyShortcutParentPath(item);
    }
  };

  return (
    <div className="item-list" ref={listRef}>
      {items.map((item, index) => (
        <div
          key={`${item.name}-${index}`}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          className={`item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => {
            onItemSelect(index);
            onItemClick(item);
          }}
          onMouseEnter={() => onItemSelect(index)}
          onContextMenu={(e) => handleContextMenu(e, item)}
          title={getFullPath(item)}
        >
          <span className="item-icon">
            {item.icon ? (
              <img src={item.icon} alt="" width="24" height="24" />
            ) : (
              getDefaultIcon(item)
            )}
          </span>
          <span className="item-name">{item.name}</span>
        </div>
      ))}
      <ContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        item={contextMenu.item}
        onClose={handleCloseContextMenu}
        onCopyPath={handleCopyPath}
        onCopyParentPath={handleCopyParentPath}
        onCopyShortcutPath={handleCopyShortcutPath}
        onCopyShortcutParentPath={handleCopyShortcutParentPath}
      />
    </div>
  );
};

export default ItemList;
