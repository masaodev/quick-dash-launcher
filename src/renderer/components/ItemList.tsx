import React, { useEffect, useRef } from 'react';

import { LauncherItem } from '../../common/types';

interface ItemListProps {
  items: LauncherItem[];
  selectedIndex: number;
  onItemClick: (item: LauncherItem) => void;
  onItemSelect: (index: number) => void;
}

const ItemList: React.FC<ItemListProps> = ({ items, selectedIndex, onItemClick, onItemSelect }) => {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    </div>
  );
};

export default ItemList;
