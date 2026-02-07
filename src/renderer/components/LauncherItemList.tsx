import React, { useEffect, useRef, useState } from 'react';
import {
  isLauncherItem,
  isWindowInfo,
  isGroupItem,
  isWindowItem,
  isClipboardItem,
} from '@common/types/guards';
import { LauncherItem, GroupItem, AppItem } from '@common/types';

import { getTooltipText } from '../utils/tooltipTextGenerator';
import { logError } from '../utils/debug';

import MemoViewModal from './MemoViewModal';
import '../styles/components/MemoViewModal.css';

interface ItemListProps {
  items: AppItem[];
  selectedIndex: number;
  onItemExecute: (item: AppItem) => void;
  onItemSelect: (index: number) => void;
  onCopyPath?: (item: LauncherItem) => void;
  onCopyParentPath?: (item: LauncherItem) => void;
  onOpenParentFolder?: (item: LauncherItem) => void;
  onCopyShortcutPath?: (item: LauncherItem) => void;
  onCopyShortcutParentPath?: (item: LauncherItem) => void;
  onOpenShortcutParentFolder?: (item: LauncherItem) => void;
  onEditItem?: (item: AppItem) => void | Promise<void>;
  onRefreshWindows?: () => Promise<void>;
}

const LauncherItemList: React.FC<ItemListProps> = ({
  items,
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
  onRefreshWindows,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [memoModalItem, setMemoModalItem] = useState<{ name: string; memo: string } | null>(null);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({
      block: 'nearest',
      behavior: 'smooth',
    });
  }, [selectedIndex]);

  useEffect(() => {
    /** hwndからウィンドウタイトルを検索する */
    function findWindowTitle(hwnd: number | bigint): string {
      const found = items.find((item) => isWindowInfo(item) && item.hwnd === hwnd);
      return found && isWindowInfo(found) ? found.title : '不明なウィンドウ';
    }

    const cleanupEditItem = window.electronAPI.onLauncherMenuEditItem((item) => {
      onEditItem?.(item);
    });

    const cleanupAddToWorkspace = window.electronAPI.onLauncherMenuAddToWorkspace(async (item) => {
      try {
        await window.electronAPI.workspaceAPI.addItem(item);
        if (isLauncherItem(item)) {
          await window.electronAPI.showToastWindow({
            displayName: item.displayName,
            itemType: 'workspaceAdd',
            path: item.path,
            icon: item.icon,
          });
        }
      } catch (error) {
        logError('ワークスペースへの追加に失敗しました:', error);
        if (isLauncherItem(item)) {
          await window.electronAPI.showToastWindow({
            displayName: item.displayName,
            itemType: 'workspaceAdd',
            message: 'ワークスペースへの追加に失敗しました',
          });
        }
      }
    });

    const createLauncherItemHandler = (handler?: (item: LauncherItem) => void) => {
      return (item: AppItem) => {
        if (isLauncherItem(item) && handler) {
          handler(item);
        }
      };
    };

    const cleanupCopyPath = window.electronAPI.onLauncherMenuCopyPath(
      createLauncherItemHandler(onCopyPath)
    );
    const cleanupCopyParentPath = window.electronAPI.onLauncherMenuCopyParentPath(
      createLauncherItemHandler(onCopyParentPath)
    );
    const cleanupOpenParentFolder = window.electronAPI.onLauncherMenuOpenParentFolder(
      createLauncherItemHandler(onOpenParentFolder)
    );
    const cleanupCopyShortcutPath = window.electronAPI.onLauncherMenuCopyShortcutPath(
      createLauncherItemHandler(onCopyShortcutPath)
    );
    const cleanupCopyShortcutParentPath = window.electronAPI.onLauncherMenuCopyShortcutParentPath(
      createLauncherItemHandler(onCopyShortcutParentPath)
    );
    const cleanupOpenShortcutParentFolder =
      window.electronAPI.onLauncherMenuOpenShortcutParentFolder(
        createLauncherItemHandler(onOpenShortcutParentFolder)
      );

    const cleanupActivateWindow = window.electronAPI.onWindowMenuActivate(onItemExecute);

    const cleanupMoveWindowToDesktop = window.electronAPI.onMoveWindowToDesktop(
      async (hwnd, desktopNumber) => {
        try {
          const windowTitle = findWindowTitle(hwnd);
          const result = await window.electronAPI.moveWindowToDesktop(hwnd, desktopNumber);
          if (result.success) {
            await window.electronAPI.showToastWindow({
              displayName: windowTitle,
              itemType: 'windowMoveDesktop',
              message: `ウィンドウをデスクトップ ${desktopNumber} に移動しました`,
            });
            await onRefreshWindows?.();
          } else {
            await window.electronAPI.showToastWindow({
              displayName: windowTitle,
              itemType: 'windowMoveDesktop',
              message: `ウィンドウの移動に失敗しました: ${result.error || '不明なエラー'}`,
            });
          }
        } catch (error) {
          logError('ウィンドウの移動に失敗しました:', error);
          await window.electronAPI.showToastWindow({
            displayName: '不明なウィンドウ',
            itemType: 'windowMoveDesktop',
            message: 'ウィンドウの移動に失敗しました',
          });
        }
      }
    );

    const handleWindowPinOperation = async (
      fn: (hwnd: number | bigint) => Promise<{ success: boolean; error?: string }>,
      itemType: 'windowPin' | 'windowUnpin',
      errorPrefix: string,
      hwnd: number | bigint
    ): Promise<void> => {
      try {
        const windowTitle = findWindowTitle(hwnd);
        const result = await fn(hwnd);
        if (result.success) {
          await window.electronAPI.showToastWindow({
            displayName: windowTitle,
            itemType: itemType,
          });
        } else {
          await window.electronAPI.showToastWindow({
            displayName: windowTitle,
            itemType: itemType,
            message: `${errorPrefix}に失敗しました: ${result.error || '不明なエラー'}`,
          });
        }
      } catch (error) {
        logError(`${errorPrefix}に失敗しました:`, error);
        await window.electronAPI.showToastWindow({
          displayName: '不明なウィンドウ',
          itemType: itemType,
          message: `${errorPrefix}に失敗しました`,
        });
      }
    };

    const cleanupPinWindow = window.electronAPI.onPinWindow((hwnd) =>
      handleWindowPinOperation(window.electronAPI.pinWindow, 'windowPin', 'ウィンドウの固定', hwnd)
    );

    const cleanupUnPinWindow = window.electronAPI.onUnPinWindow((hwnd) =>
      handleWindowPinOperation(
        window.electronAPI.unPinWindow,
        'windowUnpin',
        'ウィンドウの固定解除',
        hwnd
      )
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
      cleanupActivateWindow();
      cleanupMoveWindowToDesktop();
      cleanupPinWindow();
      cleanupUnPinWindow();
    };
  }, [
    onEditItem,
    onItemExecute,
    onCopyPath,
    onCopyParentPath,
    onOpenParentFolder,
    onCopyShortcutPath,
    onCopyShortcutParentPath,
    onOpenShortcutParentFolder,
    onRefreshWindows,
  ]);

  const DEFAULT_ICONS: Record<string, string> = {
    url: '🌐',
    folder: '📁',
    app: '⚙️',
    file: '📄',
    customUri: '🔗',
    group: '📦',
    window: '🪟',
    clipboard: '📋',
  };

  function getItemIcon(item: AppItem): React.ReactNode {
    const customIcon =
      (isLauncherItem(item) && item.icon) ||
      (isWindowInfo(item) && item.icon) ||
      (isClipboardItem(item) && item.customIcon);

    if (customIcon) {
      return <img src={customIcon} alt="" width="24" height="24" />;
    }

    if (isWindowInfo(item)) {
      return '🪟';
    }

    return DEFAULT_ICONS[item.type] || '❓';
  }

  // ドラッグ&ドロップハンドラー（ワークスペースへの追加用）
  const handleDragStart = (e: React.DragEvent, item: AppItem, index: number) => {
    if (isWindowInfo(item)) {
      e.preventDefault();
      return;
    }

    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'copy';
    // AppItemをワークスペース側にJSON転送（WindowInfoはドラッグ不可のため除外済み）
    e.dataTransfer.setData('launcherItem', JSON.stringify(item));
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  const handleMemoClick = (e: React.MouseEvent, item: AppItem) => {
    e.stopPropagation();
    const name = isWindowInfo(item) ? item.title : item.displayName;
    const memo = 'memo' in item ? (item.memo as string) || '' : '';
    setMemoModalItem({ name, memo });
    setMemoModalOpen(true);
  };

  const handleContextMenu = async (event: React.MouseEvent, item: AppItem) => {
    event.preventDefault();
    event.stopPropagation();

    if (isWindowInfo(item)) {
      const [desktopInfo, isPinned] = await Promise.all([
        window.electronAPI.getVirtualDesktopInfo(),
        window.electronAPI.isWindowPinned(item.hwnd),
      ]);
      window.electronAPI.showWindowContextMenu(item, desktopInfo, isPinned);
      return;
    }

    window.electronAPI.showLauncherContextMenu(item);
  };

  return (
    <div className="item-list" ref={listRef}>
      {items.map((item, index) => {
        const isWindow = isWindowInfo(item);
        const isGroup = isGroupItem(item);
        const isWindowOperation = isWindowItem(item);
        const isClipboard = isClipboardItem(item);
        const isDraggable = !isWindow;
        const isDragging = draggedItemIndex === index;

        let itemName: string;
        if (isWindow) {
          itemName = item.processName ? `${item.title} (${item.processName})` : item.title;
        } else {
          itemName = item.displayName;
        }

        let itemKey: string;
        if (isWindow) {
          itemKey = `window-${item.hwnd}`;
        } else if (isWindowOperation) {
          itemKey = `windowop-${itemName}-${index}`;
        } else {
          itemKey = `${itemName}-${index}`;
        }

        const classNames = [
          'item',
          index === selectedIndex && 'selected',
          isGroup && 'group-item',
          isWindow && 'window-item',
          isWindowOperation && 'window-operation-item',
          isClipboard && 'clipboard-item',
          isDragging && 'dragging',
        ]
          .filter(Boolean)
          .join(' ');

        const hasMemo = !isWindow && 'memo' in item && item.memo;

        return (
          <div
            key={itemKey}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            className={classNames}
            draggable={isDraggable}
            onDragStart={(e) => handleDragStart(e, item, index)}
            onDragEnd={handleDragEnd}
            onClick={() => {
              onItemSelect(index);
              onItemExecute(item);
            }}
            onMouseEnter={() => onItemSelect(index)}
            onContextMenu={(e) => handleContextMenu(e, item)}
            title={getTooltipText(item)}
          >
            <span className="item-icon">{getItemIcon(item)}</span>
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
              {hasMemo && (
                <span
                  className="memo-badge"
                  onClick={(e) => handleMemoClick(e, item)}
                  title="メモを表示"
                >
                  📝
                </span>
              )}
            </span>
          </div>
        );
      })}

      <MemoViewModal
        isOpen={memoModalOpen}
        onClose={() => setMemoModalOpen(false)}
        itemName={memoModalItem?.name || ''}
        memo={memoModalItem?.memo || ''}
      />
    </div>
  );
};

export default LauncherItemList;
