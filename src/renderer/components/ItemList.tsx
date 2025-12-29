import React, { useEffect, useRef, useState } from 'react';
import { PathUtils } from '@common/utils/pathUtils';
import { isLauncherItem, isWindowOperationItem } from '@common/utils/typeGuards';

import {
  LauncherItem,
  GroupItem,
  AppItem,
  WindowInfo,
  WindowOperationItem,
} from '../../common/types';

import ContextMenu from './ContextMenu';

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

const ItemList: React.FC<ItemListProps> = ({
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

  const getTooltipText = (item: AppItem): string => {
    // WindowInfoの場合
    if ('hwnd' in item) {
      const win = item as WindowInfo;
      const lines: string[] = [];
      lines.push(`ウィンドウタイトル: ${win.title}`);

      if (win.processName) {
        lines.push(`プロセス名: ${win.processName}`);
      }

      if (win.executablePath) {
        lines.push(`実行ファイルパス: ${win.executablePath}`);
      }

      if (win.windowState) {
        const stateText =
          win.windowState === 'minimized' ? '最小化' :
          win.windowState === 'maximized' ? '最大化' : '通常';
        lines.push(`状態: ${stateText}`);
      }

      lines.push('');
      lines.push(`位置: (${win.x}, ${win.y})`);
      lines.push(`サイズ: ${win.width}x${win.height}`);
      lines.push(`プロセスID: ${win.processId}`);
      return lines.join('\n');
    }

    if (item.type === 'group') {
      const groupItem = item as GroupItem;
      const lines: string[] = [];
      lines.push(`グループ: ${groupItem.itemNames.join(', ')}`);

      // 空行
      lines.push('');

      // ソースファイル情報
      if (groupItem.sourceFile) {
        lines.push(`データファイル: ${groupItem.sourceFile}`);
      }

      // 行番号情報
      if (groupItem.lineNumber) {
        lines.push(`行番号: ${groupItem.lineNumber}`);
      }

      return lines.join('\n');
    }

    // WindowOperationItemの場合
    if (item.type === 'windowOperation') {
      const windowOp = item as WindowOperationItem;
      const lines: string[] = [];
      lines.push(`ウィンドウタイトル: ${windowOp.windowTitle}`);

      // 空行
      lines.push('');

      // 位置・サイズ情報
      if (windowOp.x !== undefined && windowOp.y !== undefined) {
        lines.push(`位置: (${windowOp.x}, ${windowOp.y})`);
      }
      if (windowOp.width !== undefined && windowOp.height !== undefined) {
        lines.push(`サイズ: ${windowOp.width}x${windowOp.height}`);
      }

      // 仮想デスクトップ情報
      if (windowOp.virtualDesktopNumber !== undefined) {
        lines.push(`仮想デスクトップ: ${windowOp.virtualDesktopNumber}`);
      }

      // アクティブ化フラグ
      if (windowOp.activateWindow === false) {
        lines.push(`アクティブ化: しない`);
      }

      // 空行（メタ情報との区切り）
      if (windowOp.sourceFile || windowOp.lineNumber) {
        lines.push('');
      }

      // ソースファイル情報
      if (windowOp.sourceFile) {
        lines.push(`データファイル: ${windowOp.sourceFile}`);
      }

      // 行番号情報
      if (windowOp.lineNumber) {
        lines.push(`行番号: ${windowOp.lineNumber}`);
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
      lines.push(`データファイル: ${launcherItem.sourceFile}`);
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
      console.error('ワークスペースへの追加に失敗しました:', error);
    }
  };

  return (
    <div className="item-list" ref={listRef}>
      {items.map((item, index) => {
        const isWindow = 'hwnd' in item;
        const isGroup = !isWindow && item.type === 'group';
        const isWindowOperation = !isWindow && item.type === 'windowOperation';
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
              {isLauncherItem(item) && item.windowTitle && (
                <span className="window-title-badge" title={`ウィンドウ検索: ${item.windowTitle}`}>
                  🔍
                </span>
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
        onOpenShortcutParentFolder={onOpenShortcutParentFolder}
        onEditItem={onEditItem}
        onAddToWorkspace={handleAddToWorkspace}
      />
    </div>
  );
};

export default ItemList;
