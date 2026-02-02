import React, { useEffect, useRef, useState } from 'react';
import {
  isLauncherItem,
  isWindowInfo,
  isGroupItem,
  isWindowItem,
  isClipboardItem,
} from '@common/types/guards';
import {
  LauncherItem,
  GroupItem,
  AppItem,
  WindowInfo,
  WindowItem,
  ClipboardItem,
} from '@common/types';

import { getTooltipText } from '../utils/tooltipTextGenerator';
import { logError } from '../utils/debug';

import MemoViewModal from './MemoViewModal';
import '../styles/components/MemoViewModal.css';

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
  onRefreshWindows?: () => Promise<void>;
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
  onRefreshWindows,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const contextMenuItemRef = useRef<AppItem | null>(null);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [memoModalItem, setMemoModalItem] = useState<{ name: string; memo: string } | null>(null);

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
    const cleanupActivateWindow = window.electronAPI.onWindowMenuActivate((windowInfo) => {
      onItemExecute(windowInfo);
    });

    const cleanupMoveWindowToDesktop = window.electronAPI.onMoveWindowToDesktop(
      async (hwnd, desktopNumber) => {
        try {
          const result = await window.electronAPI.moveWindowToDesktop(hwnd, desktopNumber);
          if (result.success) {
            window.electronAPI.showToastWindow(
              `ウィンドウをデスクトップ ${desktopNumber} に移動しました`,
              'success'
            );
            // ウィンドウリストを更新
            if (onRefreshWindows) {
              await onRefreshWindows();
            }
          } else {
            window.electronAPI.showToastWindow(
              `ウィンドウの移動に失敗しました: ${result.error || '不明なエラー'}`,
              'error'
            );
          }
        } catch (error) {
          logError('ウィンドウの移動に失敗しました:', error);
          window.electronAPI.showToastWindow('ウィンドウの移動に失敗しました', 'error');
        }
      }
    );

    // ウィンドウのPin操作共通ハンドラー
    const handleWindowPinOperation = async (operation: 'pin' | 'unpin', hwnd: number | bigint) => {
      const config = {
        pin: {
          fn: window.electronAPI.pinWindow,
          successMsg: 'ウィンドウを全デスクトップに固定しました',
          errorPrefix: 'ウィンドウの固定',
        },
        unpin: {
          fn: window.electronAPI.unPinWindow,
          successMsg: 'ウィンドウの固定を解除しました',
          errorPrefix: 'ウィンドウの固定解除',
        },
      };

      const { fn, successMsg, errorPrefix } = config[operation];

      try {
        const result = await fn(hwnd);
        if (result.success) {
          window.electronAPI.showToastWindow(successMsg, 'success');
        } else {
          window.electronAPI.showToastWindow(
            `${errorPrefix}に失敗しました: ${result.error || '不明なエラー'}`,
            'error'
          );
        }
      } catch (error) {
        logError(`${errorPrefix}に失敗しました:`, error);
        window.electronAPI.showToastWindow(`${errorPrefix}に失敗しました`, 'error');
      }
    };

    const cleanupPinWindow = window.electronAPI.onPinWindow((hwnd) =>
      handleWindowPinOperation('pin', hwnd)
    );

    const cleanupUnPinWindow = window.electronAPI.onUnPinWindow((hwnd) =>
      handleWindowPinOperation('unpin', hwnd)
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

  function getDefaultIcon(item: AppItem): string {
    if (isWindowInfo(item)) {
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
      case 'window':
        return '🪟';
      case 'clipboard':
        return '📋';
      default:
        return '❓';
    }
  }

  /** アイテムのアイコン（カスタムまたはデフォルト）を取得 */
  function getItemIcon(item: AppItem): React.ReactNode {
    // LauncherItemでカスタムアイコンがある場合
    if (isLauncherItem(item) && item.icon) {
      return <img src={item.icon} alt="" width="24" height="24" />;
    }
    // WindowInfoでアイコンがある場合
    if (isWindowInfo(item) && item.icon) {
      return <img src={item.icon} alt="" width="24" height="24" />;
    }
    // ClipboardItemでカスタムアイコンがある場合
    if (isClipboardItem(item) && item.customIcon) {
      return <img src={item.customIcon} alt="" width="24" height="24" />;
    }
    // デフォルトアイコン
    return getDefaultIcon(item);
  }

  // ドラッグ&ドロップハンドラー（ワークスペースへの追加用）
  const handleDragStart = (e: React.DragEvent, item: AppItem, index: number) => {
    // LauncherItemのみドラッグ可能
    if (!isLauncherItem(item)) {
      e.preventDefault();
      return;
    }

    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('launcherItem', JSON.stringify(item));
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  const handleMemoClick = (e: React.MouseEvent, item: AppItem) => {
    e.stopPropagation();
    const name = isWindowInfo(item)
      ? item.title
      : isWindowItem(item) || isClipboardItem(item)
        ? item.displayName
        : (item as LauncherItem | GroupItem).displayName;
    const memo = (item as LauncherItem | GroupItem | WindowItem | ClipboardItem).memo || '';
    setMemoModalItem({ name, memo });
    setMemoModalOpen(true);
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
      // ウィンドウが固定されているか確認
      const isPinned = await window.electronAPI.isWindowPinned(windowInfo.hwnd);
      window.electronAPI.showWindowContextMenu(windowInfo, desktopInfo, isPinned);
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
        const isWindowOperation = isWindowItem(item);
        const windowInfo = isWindow ? (item as WindowInfo) : null;
        const isClipboard = isClipboardItem(item);
        const itemName = isWindow
          ? windowInfo?.processName
            ? `${windowInfo.title} (${windowInfo.processName})`
            : windowInfo!.title
          : isWindowOperation || isClipboard
            ? (item as WindowItem | ClipboardItem).displayName
            : (item as LauncherItem | GroupItem).displayName;

        const isDraggable = isLauncherItem(item);
        const isDragging = draggedItemIndex === index;

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
            className={`item ${index === selectedIndex ? 'selected' : ''} ${isGroup ? 'group-item' : ''} ${isWindow ? 'window-item' : ''} ${isWindowOperation ? 'window-operation-item' : ''} ${isClipboard ? 'clipboard-item' : ''} ${isDragging ? 'dragging' : ''}`}
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
              {!isWindowInfo(item) &&
                (item as LauncherItem | GroupItem | WindowItem | ClipboardItem).memo && (
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

      {/* メモ表示モーダル */}
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
