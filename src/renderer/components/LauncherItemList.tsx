import React, { useEffect, useRef } from 'react';
import {
  isLauncherItem,
  isWindowInfo,
  isGroupItem,
  isWindowOperationItem,
} from '@common/types/guards';
import { LauncherItem, GroupItem, AppItem, WindowInfo, WindowOperationItem } from '@common/types';

import { getTooltipText } from '../utils/tooltipTextGenerator';
import { logError } from '../utils/debug';

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
  const contextMenuItemRef = useRef<AppItem | null>(null);

  useEffect(() => {
    // Scroll selected item into view
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // LauncherContextMenuイベントリスナー登録
  useEffect(() => {
    const cleanupEditItem = window.electronAPI.onLauncherMenuEditItem((item) => {
      if (onEditItem) {
        onEditItem(item);
      }
    });

    const cleanupAddToWorkspace = window.electronAPI.onLauncherMenuAddToWorkspace(async (item) => {
      try {
        await window.electronAPI.workspaceAPI.addItem(item);
      } catch (error) {
        logError('ワークスペースへの追加に失敗しました:', error);
      }
    });

    const cleanupCopyPath = window.electronAPI.onLauncherMenuCopyPath((item) => {
      if (isLauncherItem(item) && onCopyPath) {
        onCopyPath(item);
      }
    });

    const cleanupCopyParentPath = window.electronAPI.onLauncherMenuCopyParentPath((item) => {
      if (isLauncherItem(item) && onCopyParentPath) {
        onCopyParentPath(item);
      }
    });

    const cleanupOpenParentFolder = window.electronAPI.onLauncherMenuOpenParentFolder((item) => {
      if (isLauncherItem(item) && onOpenParentFolder) {
        onOpenParentFolder(item);
      }
    });

    const cleanupCopyShortcutPath = window.electronAPI.onLauncherMenuCopyShortcutPath((item) => {
      if (isLauncherItem(item) && onCopyShortcutPath) {
        onCopyShortcutPath(item);
      }
    });

    const cleanupCopyShortcutParentPath = window.electronAPI.onLauncherMenuCopyShortcutParentPath(
      (item) => {
        if (isLauncherItem(item) && onCopyShortcutParentPath) {
          onCopyShortcutParentPath(item);
        }
      }
    );

    const cleanupOpenShortcutParentFolder =
      window.electronAPI.onLauncherMenuOpenShortcutParentFolder((item) => {
        if (isLauncherItem(item) && onOpenShortcutParentFolder) {
          onOpenShortcutParentFolder(item);
        }
      });

    // WindowContextMenuイベントリスナー
    const cleanupMoveWindowToDesktop = window.electronAPI.onMoveWindowToDesktop(
      async (hwnd, desktopNumber) => {
        try {
          const result = await window.electronAPI.moveWindowToDesktop(hwnd, desktopNumber);
          if (result.success) {
            window.electronAPI.showToast(
              `ウィンドウをデスクトップ ${desktopNumber} に移動しました`,
              'success'
            );
          } else {
            window.electronAPI.showToast(
              `ウィンドウの移動に失敗しました: ${result.error || '不明なエラー'}`,
              'error'
            );
          }
        } catch (error) {
          logError('ウィンドウの移動に失敗しました:', error);
          window.electronAPI.showToast('ウィンドウの移動に失敗しました', 'error');
        }
      }
    );

    return () => {
      cleanupEditItem();
      cleanupAddToWorkspace();
      cleanupCopyPath();
      cleanupCopyParentPath();
      cleanupOpenParentFolder();
      cleanupCopyShortcutPath();
      cleanupCopyShortcutParentPath();
      cleanupOpenShortcutParentFolder();
      cleanupMoveWindowToDesktop();
    };
  }, [
    onEditItem,
    onCopyPath,
    onCopyParentPath,
    onOpenParentFolder,
    onCopyShortcutPath,
    onCopyShortcutParentPath,
    onOpenShortcutParentFolder,
  ]);

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

  const handleContextMenu = async (event: React.MouseEvent, item: AppItem) => {
    event.preventDefault();
    event.stopPropagation();

    // Store item in ref for event listeners
    contextMenuItemRef.current = item;

    // WindowInfo用のコンテキストメニューを表示
    if (isWindowInfo(item)) {
      const windowInfo = item as WindowInfo;
      // 仮想デスクトップ情報を取得
      const desktopInfo = await window.electronAPI.getVirtualDesktopInfo();
      window.electronAPI.showWindowContextMenu(windowInfo, desktopInfo);
      return;
    }

    // Show native context menu
    window.electronAPI.showLauncherContextMenu(item);
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
    </div>
  );
};

export default LauncherItemList;
