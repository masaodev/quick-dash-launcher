import React, { useEffect, useRef, useState } from 'react';
import { PathUtils } from '@common/utils/pathUtils';

import { LauncherItem, GroupItem, AppItem } from '../../common/types';

import ContextMenu from './ContextMenu';

interface ItemListProps {
  items: AppItem[];
  allItems: AppItem[]; // グループ実行時の参照解決用
  selectedIndex: number;
  onItemClick: (item: LauncherItem) => void;
  onGroupExecute: (group: GroupItem) => void;
  onItemSelect: (index: number) => void;
  onCopyPath?: (item: LauncherItem) => void;
  onCopyParentPath?: (item: LauncherItem) => void;
  onOpenParentFolder?: (item: LauncherItem) => void;
  onCopyShortcutPath?: (item: LauncherItem) => void;
  onCopyShortcutParentPath?: (item: LauncherItem) => void;
}

const ItemList: React.FC<ItemListProps> = ({
  items,
  allItems: _allItems,
  selectedIndex,
  onItemClick,
  onGroupExecute,
  onItemSelect,
  onCopyPath,
  onCopyParentPath,
  onOpenParentFolder,
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

  const getDefaultIcon = (item: AppItem) => {
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
      case 'group':
        return '📦';
      default:
        return '❓';
    }
  };

  const getTooltipText = (item: AppItem): string => {
    if (item.type === 'group') {
      const groupItem = item as GroupItem;
      const lines: string[] = [];
      lines.push(`グループ: ${groupItem.itemNames.join(', ')}`);

      // 空行
      lines.push('');

      // ソースファイル情報
      if (groupItem.sourceFile) {
        lines.push(`データ元: ${groupItem.sourceFile}`);
      }

      // 行番号情報
      if (groupItem.lineNumber) {
        lines.push(`行番号: ${groupItem.lineNumber}`);
      }

      return lines.join('\n');
    }

    const launcherItem = item as LauncherItem;
    const lines: string[] = [];

    // パス情報（最初に表示）
    lines.push(PathUtils.getFullPath(launcherItem));

    // 空行を追加してメタ情報を分離
    lines.push('');

    // ソースファイル情報
    if (launcherItem.sourceFile) {
      lines.push(`データ元: ${launcherItem.sourceFile}`);
    }

    // 行番号情報
    if (launcherItem.lineNumber) {
      lines.push(`行番号: ${launcherItem.lineNumber}`);
    }

    // 取込元情報（フォルダ取込から展開されたアイテムの場合）
    if (launcherItem.expandedFrom) {
      lines.push(`取込元: ${launcherItem.expandedFrom}`);
    }

    // フォルダ取込オプション情報
    if (launcherItem.expandedOptions) {
      lines.push(`設定: ${launcherItem.expandedOptions}`);
    }

    return lines.join('\n');
  };

  const handleContextMenu = (event: React.MouseEvent, item: AppItem) => {
    event.preventDefault();
    event.stopPropagation();

    // グループアイテムの場合はコンテキストメニューを表示しない
    if (item.type === 'group') {
      return;
    }

    setContextMenu({
      isVisible: true,
      position: { x: event.clientX, y: event.clientY },
      item: item as LauncherItem,
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

  const handleOpenParentFolder = (item: LauncherItem) => {
    if (onOpenParentFolder) {
      onOpenParentFolder(item);
    }
  };

  return (
    <div className="item-list" ref={listRef}>
      {items.map((item, index) => {
        const isGroup = item.type === 'group';
        const groupItem = isGroup ? (item as GroupItem) : null;

        return (
          <div
            key={`${item.name}-${index}`}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            className={`item ${index === selectedIndex ? 'selected' : ''} ${isGroup ? 'group-item' : ''}`}
            onClick={() => {
              onItemSelect(index);
              if (isGroup && groupItem) {
                onGroupExecute(groupItem);
              } else {
                onItemClick(item as LauncherItem);
              }
            }}
            onMouseEnter={() => onItemSelect(index)}
            onContextMenu={(e) => handleContextMenu(e, item)}
            title={getTooltipText(item)}
          >
            <span className="item-icon">
              {!isGroup && (item as LauncherItem).icon ? (
                <img src={(item as LauncherItem).icon} alt="" width="24" height="24" />
              ) : (
                getDefaultIcon(item)
              )}
            </span>
            <span className="item-name">
              {item.name}
              {isGroup && groupItem && (
                <span className="group-count"> ({groupItem.itemNames.length}個)</span>
              )}
            </span>
          </div>
        );
      })}
      <ContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        item={contextMenu.item}
        onClose={handleCloseContextMenu}
        onCopyPath={handleCopyPath}
        onCopyParentPath={handleCopyParentPath}
        onOpenParentFolder={handleOpenParentFolder}
        onCopyShortcutPath={handleCopyShortcutPath}
        onCopyShortcutParentPath={handleCopyShortcutParentPath}
      />
    </div>
  );
};

export default ItemList;
