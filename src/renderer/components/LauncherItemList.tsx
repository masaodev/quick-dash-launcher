import React, { useEffect, useRef, useState } from 'react';
import {
  isLauncherItem,
  isWindowInfo,
  isGroupItem,
  isWindowOperationItem,
} from '@common/utils/typeGuards';
import { LauncherItem, GroupItem, AppItem, WindowInfo, WindowOperationItem } from '@common/types';

import { getTooltipText } from '../utils/tooltipTextGenerator';
import { logError } from '../utils/debug';

import LauncherContextMenu from './LauncherContextMenu';

interface ItemListProps {
  items: AppItem[];
  allItems: AppItem[]; // グループ実行時の参照解決用
  selectedIndex: number;
  onItemExecute: (item: AppItem) => void; // 統一ハンドラ
  onItemSelect: (index: number) => void;
  onCopyPath?: (item: LauncherItem) => void;
  onCopyParentPath?: (item: LauncherItem) => void;
  onOpenParentFolder?: (item: LauncherItem) => void;
  onCopyShortcutPath?: (item: LauncherItem) => void;
  onCopyShortcutParentPath?: (item: LauncherItem) => void;
  onOpenShortcutParentFolder?: (item: LauncherItem) => void;
  onEditItem?: (item: AppItem) => void | Promise<void>;
}

const LauncherItemList: React.FC<ItemListProps> = ({
  items,
  allItems: _allItems,
  selectedIndex,
  onItemExecute,
  onItemSelect,
  onCopyPath,
  onCopyParentPath,
  onOpenParentFolder,
  onCopyShortcutPath,
  onCopyShortcutParentPath,
  onOpenShortcutParentFolder,
  onEditItem,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    position: { x: number; y: number };
    item: AppItem | null;
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
    // WindowInfoの場合
    if ('hwnd' in item) {
      return '🪟';
    }

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
      case 'windowOperation':
        return '🪟';
      default:
        return '❓';
    }
  };

  const handleContextMenu = (event: React.MouseEvent, item: AppItem) => {
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

  const handleOpenParentFolder = (item: LauncherItem) => {
    if (onOpenParentFolder) {
      onOpenParentFolder(item);
    }
  };

  const handleAddToWorkspace = async (item: AppItem) => {
    try {
      await window.electronAPI.workspaceAPI.addItem(item);
    } catch (error) {
      logError('ワークスペースへの追加に失敗しました:', error);
    }
  };

  return (
    <div className="item-list" ref={listRef}>
      {items.map((item, index) => {
        const isWindow = isWindowInfo(item);
        const isGroup = isGroupItem(item);
        const isWindowOperation = isWindowOperationItem(item);
        const windowInfo = isWindow ? (item as WindowInfo) : null;
        const itemName = isWindow
          ? windowInfo?.processName
            ? `${windowInfo.title} (${windowInfo.processName})`
            : windowInfo!.title
          : isWindowOperation
            ? (item as WindowOperationItem).name
            : (item as LauncherItem | GroupItem).name;

        return (
          <div
            key={
              isWindow
                ? `window-${(item as WindowInfo).hwnd}`
                : isWindowOperation
                  ? `windowop-${itemName}-${index}`
                  : `${itemName}-${index}`
            }
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            className={`item ${index === selectedIndex ? 'selected' : ''} ${isGroup ? 'group-item' : ''} ${isWindow ? 'window-item' : ''} ${isWindowOperation ? 'window-operation-item' : ''}`}
            onClick={() => {
              onItemSelect(index);
              onItemExecute(item);
            }}
            onMouseEnter={() => onItemSelect(index)}
            onContextMenu={(e) => handleContextMenu(e, item)}
            title={getTooltipText(item)}
          >
            <span className="item-icon">
              {!isGroup && !isWindow && !isWindowOperation && (item as LauncherItem).icon ? (
                <img src={(item as LauncherItem).icon} alt="" width="24" height="24" />
              ) : isWindow && (item as WindowInfo).icon ? (
                <img src={(item as WindowInfo).icon} alt="" width="24" height="24" />
              ) : (
                getDefaultIcon(item)
              )}
            </span>
            <span className="item-name">
              {itemName}
              {isGroup && (
                <span className="group-count"> ({(item as GroupItem).itemNames.length}個)</span>
              )}
              {isLauncherItem(item) && item.windowConfig?.title && (
                <span
                  className="window-title-badge"
                  title={`ウィンドウ検索: ${item.windowConfig.title}`}
                >
                  🔍
                </span>
              )}
            </span>
          </div>
        );
      })}
      <LauncherContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        item={contextMenu.item}
        onClose={handleCloseContextMenu}
        onCopyPath={handleCopyPath}
        onCopyParentPath={handleCopyParentPath}
        onOpenParentFolder={handleOpenParentFolder}
        onCopyShortcutPath={handleCopyShortcutPath}
        onCopyShortcutParentPath={handleCopyShortcutParentPath}
        onOpenShortcutParentFolder={onOpenShortcutParentFolder}
        onEditItem={onEditItem}
        onAddToWorkspace={handleAddToWorkspace}
      />
    </div>
  );
};

export default LauncherItemList;
