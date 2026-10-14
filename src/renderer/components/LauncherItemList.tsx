import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  isLauncherItem,
  isWindowInfo,
  isGroupItem,
  isSetItem,
  isWindowItem,
  isClipboardItem,
} from '@common/types/guards';
import { LauncherItem, GroupItem, AppItem, WindowInfo } from '@common/types';
import { windowInfoToWindowItem } from '@common/utils/windowInfoConverter';

import { getTooltipText } from '../utils/tooltipTextGenerator';
import { logError } from '../utils/debug';

import MemoViewModal from './MemoViewModal';
import '../styles/components/MemoViewModal.css';

const DEFAULT_ICONS: Record<string, string> = {
  url: '🌐',
  folder: '📁',
  app: '⚙️',
  file: '📄',
  customUri: '🔗',
  group: '📦',
  window: '🪟',
  clipboard: '📋',
  layout: '🖥️',
  set: '📦',
};

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
  /** ウィンドウを閉じる（右クリックの「ウィンドウを閉じる」） */
  onCloseWindow?: (win: WindowInfo) => Promise<void>;
  /** 右クリックの固定・固定解除（pin: true で固定） */
  onPinWindows?: (wins: WindowInfo[], pin: boolean) => Promise<void>;
  /** 右クリックの仮想デスクトップへの移動 */
  onMoveWindows?: (wins: WindowInfo[], desktopNumber: number) => Promise<void>;
  /** ウィンドウ検索の複数選択（Ctrl+クリック・Shift+クリック・選んだ行の右クリック） */
  windowSelection?: WindowListSelection;
}

export interface WindowListSelection {
  isMarked: (hwnd: WindowInfo['hwnd']) => boolean;
  markedCount: number;
  toggle: (index: number) => void;
  selectRangeTo: (index: number) => void;
  /** 2 つ以上を選んでいるときの右クリックメニューの操作（対象は選んでいるウィンドウ） */
  onMenuClose: () => void;
  onMenuPin: (pin: boolean) => void;
  onMenuMove: (desktopNumber: number) => void;
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
  onCloseWindow,
  onPinWindows,
  onMoveWindows,
  windowSelection,
}) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [memoModalItem, setMemoModalItem] = useState<{ name: string; memo: string } | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 32, // 実測前の推定行高（padding + アイコン24px）
    overscan: 8,
  });

  const openMemoModal = (item: AppItem): void => {
    const name = isWindowInfo(item) ? item.title : item.displayName;
    const memo = 'memo' in item ? (item.memo as string) || '' : '';
    setMemoModalItem({ name, memo });
    setMemoModalOpen(true);
  };

  // 選択中アイテムを可視範囲へスクロール（仮想化のため scrollToIndex を使用）
  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      rowVirtualizer.scrollToIndex(selectedIndex, { align: 'auto' });
    }
    // rowVirtualizerは同一インスタンスが維持されるため依存に含めない
  }, [selectedIndex, items.length]);

  // リスナーからは常に最新のprops/itemsをref経由で参照する。
  // これにより下のuseEffectの依存を空にでき、レンダーごとの
  // IPCリスナー解除・再登録（約14件）を初回1回の登録だけにできる。
  const latestRef = useRef({
    items,
    onItemExecute,
    onCopyPath,
    onCopyParentPath,
    onOpenParentFolder,
    onCopyShortcutPath,
    onCopyShortcutParentPath,
    onOpenShortcutParentFolder,
    onEditItem,
    onCloseWindow,
    onPinWindows,
    onMoveWindows,
    windowSelection,
  });
  latestRef.current = {
    items,
    onItemExecute,
    onCopyPath,
    onCopyParentPath,
    onOpenParentFolder,
    onCopyShortcutPath,
    onCopyShortcutParentPath,
    onOpenShortcutParentFolder,
    onEditItem,
    onCloseWindow,
    onPinWindows,
    onMoveWindows,
    windowSelection,
  };

  useEffect(() => {
    const cleanupEditItem = window.electronAPI.onLauncherMenuEditItem((item) => {
      latestRef.current.onEditItem?.(item);
    });

    const cleanupAddToWorkspace = window.electronAPI.onLauncherMenuAddToWorkspace(async (item) => {
      // どの種類でも結果を知らせる。パスは LauncherItem だけ、アイコンは持っていれば添える
      //（ウィンドウ検索の結果は別のイベント onWindowMenuAddToWorkspace で来るが、型の上では来うる）
      const displayName = isWindowInfo(item) ? item.title : item.displayName;
      try {
        await window.electronAPI.workspaceAPI.addItem(item);
        await window.electronAPI.showToastWindow({
          displayName,
          itemType: 'workspaceAdd',
          ...(isLauncherItem(item) && { path: item.path }),
          ...('icon' in item && item.icon && { icon: item.icon }),
        });
      } catch (error) {
        logError('ワークスペースへの追加に失敗しました:', error);
        await window.electronAPI.showToastWindow({
          displayName,
          itemType: 'workspaceAdd',
          message: t('launcher.messages.addToWorkspaceFailed'),
        });
      }
    });

    type LauncherItemHandlerKey =
      | 'onCopyPath'
      | 'onCopyParentPath'
      | 'onOpenParentFolder'
      | 'onCopyShortcutPath'
      | 'onCopyShortcutParentPath'
      | 'onOpenShortcutParentFolder';

    function createLauncherItemHandler(handlerKey: LauncherItemHandlerKey) {
      return (item: AppItem) => {
        const handler = latestRef.current[handlerKey];
        if (isLauncherItem(item) && handler) {
          handler(item);
        }
      };
    }

    /** hwnd から今の一覧のウィンドウを探す（メニューを開いた後に一覧が変わっていれば見つからない） */
    function findWindow(hwnd: number | bigint): WindowInfo | undefined {
      return latestRef.current.items.find(
        (item): item is WindowInfo => isWindowInfo(item) && item.hwnd === hwnd
      );
    }

    const cleanups = [
      cleanupEditItem,
      cleanupAddToWorkspace,
      window.electronAPI.onLauncherMenuCopyPath(createLauncherItemHandler('onCopyPath')),
      window.electronAPI.onLauncherMenuCopyParentPath(
        createLauncherItemHandler('onCopyParentPath')
      ),
      window.electronAPI.onLauncherMenuOpenParentFolder(
        createLauncherItemHandler('onOpenParentFolder')
      ),
      window.electronAPI.onLauncherMenuCopyShortcutPath(
        createLauncherItemHandler('onCopyShortcutPath')
      ),
      window.electronAPI.onLauncherMenuCopyShortcutParentPath(
        createLauncherItemHandler('onCopyShortcutParentPath')
      ),
      window.electronAPI.onLauncherMenuOpenShortcutParentFolder(
        createLauncherItemHandler('onOpenShortcutParentFolder')
      ),
      window.electronAPI.onLauncherMenuShowMemo(openMemoModal),
      window.electronAPI.onWindowMenuActivate((item) => latestRef.current.onItemExecute(item)),
      window.electronAPI.onWindowMenuAddToWorkspace(async ({ windowInfo, includePosition }) => {
        const windowItem = windowInfoToWindowItem(windowInfo, { includePosition });
        try {
          await window.electronAPI.workspaceAPI.addItem(windowItem);
          await window.electronAPI.showToastWindow({
            displayName: windowItem.displayName,
            itemType: 'workspaceAdd',
            icon: windowInfo.icon,
            message: includePosition
              ? t('launcher.messages.windowAddedWithPosition')
              : t('launcher.messages.windowAdded'),
          });
        } catch (error) {
          logError('ウィンドウのワークスペースへの追加に失敗しました:', error);
          await window.electronAPI.showToastWindow({
            displayName: windowItem.displayName,
            itemType: 'workspaceAdd',
            message: t('launcher.messages.addToWorkspaceFailed'),
          });
        }
      }),
      window.electronAPI.onWindowMenuClose((windowInfo) => {
        void latestRef.current.onCloseWindow?.(windowInfo);
      }),
      window.electronAPI.onMoveWindowToDesktop((hwnd, desktopNumber) => {
        const win = findWindow(hwnd);
        if (win) void latestRef.current.onMoveWindows?.([win], desktopNumber);
      }),
      window.electronAPI.onPinWindow((hwnd) => {
        const win = findWindow(hwnd);
        if (win) void latestRef.current.onPinWindows?.([win], true);
      }),
      window.electronAPI.onUnPinWindow((hwnd) => {
        const win = findWindow(hwnd);
        if (win) void latestRef.current.onPinWindows?.([win], false);
      }),
      window.electronAPI.onWindowsMenuClose(() => latestRef.current.windowSelection?.onMenuClose()),
      window.electronAPI.onWindowsMenuPin((pin) =>
        latestRef.current.windowSelection?.onMenuPin(pin)
      ),
      window.electronAPI.onWindowsMenuMoveToDesktop((desktopNumber) =>
        latestRef.current.windowSelection?.onMenuMove(desktopNumber)
      ),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

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
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'copy';

    if (isWindowInfo(item)) {
      // ウィンドウ検索結果は hwnd（bigint）を持ち JSON にできないので、先にウィンドウ操作アイテムへ変換する。
      // 既定はアクティブ化のみ。位置は別データで渡し、ドロップ側が Ctrl 押下時だけ採用する
      e.dataTransfer.setData('launcherItem', JSON.stringify(windowInfoToWindowItem(item)));
      e.dataTransfer.setData(
        'windowPosition',
        JSON.stringify({ x: item.x, y: item.y, width: item.width, height: item.height })
      );
      return;
    }

    // AppItemをワークスペース側にJSON転送
    e.dataTransfer.setData('launcherItem', JSON.stringify(item));
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };

  const handleMemoClick = (e: React.MouseEvent, item: AppItem) => {
    e.stopPropagation();
    openMemoModal(item);
  };

  const handleContextMenu = async (event: React.MouseEvent, item: AppItem) => {
    event.preventDefault();
    event.stopPropagation();

    const selection = latestRef.current.windowSelection;
    if (
      isWindowInfo(item) &&
      selection &&
      selection.markedCount >= 2 &&
      selection.isMarked(item.hwnd)
    ) {
      const desktopInfo = await window.electronAPI.getVirtualDesktopInfo();
      window.electronAPI.showWindowsContextMenu(selection.markedCount, desktopInfo);
      return;
    }

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
    <>
      <div className="item-list" ref={listRef}>
        <div className="item-list-inner" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const index = virtualRow.index;
            const item = items[index];
            const isWindow = isWindowInfo(item);
            const isGroup = isGroupItem(item);
            const isSet = isSetItem(item);
            const isWindowOperation = isWindowItem(item);
            const isClipboard = isClipboardItem(item);
            const isDraggable = true;
            const isDragging = draggedItemIndex === index;
            const isMarked = isWindow && !!windowSelection?.isMarked(item.hwnd);

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
              (isGroup || isSet) && 'group-item',
              isWindow && 'window-item',
              isWindowOperation && 'window-operation-item',
              isClipboard && 'clipboard-item',
              isDragging && 'dragging',
              isMarked && 'marked',
            ]
              .filter(Boolean)
              .join(' ');

            const hasMemo = !isWindow && 'memo' in item && item.memo;

            return (
              <div
                key={itemKey}
                data-index={index}
                ref={rowVirtualizer.measureElement}
                className={`item-row-wrapper ${classNames}`}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
                draggable={isDraggable}
                onDragStart={(e) => handleDragStart(e, item, index)}
                onDragEnd={handleDragEnd}
                onMouseDown={(e) => {
                  // Shift+クリックで文字列が選択されないように
                  if (e.shiftKey && isWindow) e.preventDefault();
                }}
                onClick={(e) => {
                  onItemSelect(index);
                  // ウィンドウ検索: Ctrl+クリックで 1 行ずつ、Shift+クリックで範囲を選ぶ（実行しない）
                  if (isWindow && windowSelection && (e.ctrlKey || e.shiftKey)) {
                    if (e.ctrlKey) windowSelection.toggle(index);
                    else windowSelection.selectRangeTo(index);
                    return;
                  }
                  onItemExecute(item);
                }}
                onMouseEnter={() => onItemSelect(index)}
                onContextMenu={(e) => handleContextMenu(e, item)}
                title={getTooltipText(item)}
              >
                {isMarked && (
                  <span className="item-mark" aria-label={t('launcher.list.selected')}>
                    ✓
                  </span>
                )}
                <span className="item-icon">{getItemIcon(item)}</span>
                <span className="item-name">
                  {itemName}
                  {isGroup && (
                    <span className="group-count">
                      {t('launcher.list.groupCount', {
                        count: (item as GroupItem).itemNames.length,
                      })}
                    </span>
                  )}
                  {isSet && (
                    <span className="group-count">
                      {t('launcher.list.groupCount', { count: item.entries.length })}
                      {item.entries.some((entry) => entry.placement) && (
                        <span title={t('launcher.list.setPlacedBadge')}> 📍</span>
                      )}
                    </span>
                  )}
                  {isLauncherItem(item) && item.windowConfig?.title && (
                    <span
                      className="window-title-badge"
                      title={t('launcher.list.windowSearchBadge', {
                        title: item.windowConfig.title,
                      })}
                    >
                      🔍
                    </span>
                  )}
                  {hasMemo && (
                    <span
                      className="memo-badge"
                      onClick={(e) => handleMemoClick(e, item)}
                      title={t('launcher.list.showNote')}
                    >
                      📝
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <MemoViewModal
        isOpen={memoModalOpen}
        onClose={() => setMemoModalOpen(false)}
        itemName={memoModalItem?.name || ''}
        memo={memoModalItem?.memo || ''}
      />
    </>
  );
};

export default LauncherItemList;
