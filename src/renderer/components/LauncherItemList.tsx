import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  isLauncherItem,
  isWindowInfo,
  isSetItem,
  isClipboardItem,
  isWsGroupItem,
} from '@common/types/guards';
import { LauncherItem, AppItem, WindowInfo, type WorkspaceTarget } from '@common/types';
import { windowInfoToPathlessItem } from '@common/utils/windowInfoConverter';
import { hasItemWindowSwitch } from '@common/utils/itemWindowConversion';

import { getTooltipText } from '../utils/tooltipTextGenerator';
import { logError } from '../utils/debug';
import { ITEM_TYPE_ICONS } from '../utils/itemTypeIcons';
import type { NoMatchElsewhere } from '../utils/noMatchElsewhere';
import { openAppImport, openBookmarkImport } from '../utils/importEntrances';

import { WsGroupIcon } from './WsGroupIcon';
import MemoViewModal from './MemoViewModal';
import { Button } from './ui';
import '../styles/components/MemoViewModal.css';

interface ItemListProps {
  items: AppItem[];
  selectedIndex: number;
  onItemExecute: (item: AppItem) => void;
  onItemSelect: (index: number) => void;
  onCopyPath?: (item: LauncherItem) => void;
  onCopyParentPath?: (item: LauncherItem) => void;
  onOpenParentFolder?: (item: LauncherItem) => void;
  /** 右クリックの「管理者として実行」 */
  onRunAsAdmin?: (item: LauncherItem) => void;
  onCopyShortcutPath?: (item: LauncherItem) => void;
  onCopyShortcutParentPath?: (item: LauncherItem) => void;
  onOpenShortcutParentFolder?: (item: LauncherItem) => void;
  onEditItem?: (item: AppItem) => void | Promise<void>;
  /** ウィンドウを閉じる（右クリックの「ウィンドウを閉じる」） */
  onCloseWindow?: (win: WindowInfo) => Promise<void>;
  /** 一覧が空のときの案内（検索で 0 件／空のタブ）。null なら何も出さない */
  emptyState?: LauncherEmptyState | null;
  /** 空のタブと、どこにも合わないときの案内の「アイテムを追加」 */
  onAddItem?: () => void;
  /** 空のタブの「🗂️ フォルダから」（登録画面をフォルダ取込の種別で開く）。指定があれば、ブックマーク・アプリの取込も並べる */
  onAddFolderImport?: () => void;
  /** 読めなかったデータファイルの案内の「設定フォルダを開く」 */
  onOpenConfigFolder?: () => void;
  /** 一覧の余白（アイテムの無い所）の右クリック。未指定なら何も出さない */
  onBlankContextMenu?: () => void;
  /** 他のタブにあるときの案内の「Tab:タブを切り替える」（Tab キーと同じ動き） */
  onSwitchTab?: () => void;
  /** 右クリックの固定・固定解除（pin: true で固定） */
  onPinWindows?: (wins: WindowInfo[], pin: boolean) => Promise<void>;
  /** 右クリックの仮想デスクトップへの移動 */
  onMoveWindows?: (wins: WindowInfo[], desktopNumber: number) => Promise<void>;
  /** ウィンドウ検索の複数選択（Ctrl+クリック・Shift+クリック・選んだ行の右クリック） */
  windowSelection?: WindowListSelection;
  /** id からアイテムの名前を引く（セットのツールチップに行の名前を出す。絞り込みの外のアイテムも引く） */
  nameOfItem?: (itemId: string) => string | undefined;
}

/** 一覧が空のときの案内の種類 */
export type LauncherEmptyState =
  | { kind: 'noMatch'; query: string; windowMode: boolean; elsewhere: NoMatchElsewhere }
  | { kind: 'emptyTab' }
  /** 今のタブのデータファイルを読めなかった（壊れている可能性がある）。追加の入口は出さずに直し方を案内する */
  | { kind: 'corrupted'; files: string[] };

/** 検索で 0 件のときの案内の 2 行（辞書のキー）。場面ごとの文言の対応はここだけで決める */
function noMatchKeys(windowMode: boolean, elsewhere: NoMatchElsewhere) {
  if (windowMode) {
    if (elsewhere === 'otherTab') {
      return {
        title: 'launcher.empty.noMatchWindowInTab',
        hint: 'launcher.empty.otherTabsHaveWindows',
      } as const;
    }
    return {
      title: 'launcher.empty.noMatchWindow',
      hint:
        elsewhere === 'normalSearch'
          ? 'launcher.empty.noMatchWindowNormalHint'
          : 'launcher.empty.noMatchWindowHint',
    } as const;
  }
  if (elsewhere === 'otherTab') {
    return {
      title: 'launcher.empty.noMatchInTab',
      hint: 'launcher.empty.otherTabsHaveItems',
    } as const;
  }
  return { title: 'launcher.empty.noMatch', hint: 'launcher.empty.noMatchHint' } as const;
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
  onRunAsAdmin,
  onCopyShortcutPath,
  onCopyShortcutParentPath,
  onOpenShortcutParentFolder,
  onEditItem,
  onCloseWindow,
  onPinWindows,
  onMoveWindows,
  windowSelection,
  nameOfItem,
  emptyState,
  onAddItem,
  onAddFolderImport,
  onOpenConfigFolder,
  onBlankContextMenu,
  onSwitchTab,
}) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLDivElement>(null);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [memoModalItem, setMemoModalItem] = useState<{ name: string; memo: string } | null>(null);

  // マウスを動かしたときだけ、指したアイテムを選ぶ。矢印キーで一覧がスクロールして、止まっているカーソルの下に
  // 別のアイテムが来ても選択を変えない（そのとき届く mouseenter・mousemove は移動量が 0）
  const handleItemMouseMove = (e: React.MouseEvent, index: number): void => {
    if (e.movementX === 0 && e.movementY === 0) return;
    if (index !== selectedIndex) onItemSelect(index);
  };

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
    onRunAsAdmin,
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
    onRunAsAdmin,
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

    // 「ワークスペースに追加」は参照（参照できないものはコピー）、「ワークスペースにコピーを追加」はコピー
    const addToWorkspace = async (item: AppItem, target: WorkspaceTarget, copy: boolean) => {
      // どの種類でも結果を知らせる。パスは LauncherItem だけ、アイコンは持っていれば添える
      //（ウィンドウ検索の結果は別のイベント onWindowMenuAddToWorkspace で来るが、型の上では来うる）
      const displayName = isWindowInfo(item) ? item.title : item.displayName;
      try {
        await window.electronAPI.workspaceAPI.addItem(
          item,
          target.groupId,
          target.workspaceId,
          copy ? { copy } : undefined
        );
        await window.electronAPI.showToastWindow({
          type: 'success',
          displayName,
          itemType: 'workspaceAdd',
          ...(isLauncherItem(item) && { path: item.path }),
          ...('icon' in item && item.icon && { icon: item.icon }),
        });
      } catch (error) {
        // 失敗は本体側がエラーのトーストで知らせる
        logError('ワークスペースへの追加に失敗しました:', error);
      }
    };
    const cleanupAddToWorkspace = window.electronAPI.onLauncherMenuAddToWorkspace(
      ({ item, target }) => {
        void addToWorkspace(item, target, false);
      }
    );
    const cleanupAddCopyToWorkspace = window.electronAPI.onLauncherMenuAddCopyToWorkspace(
      ({ item, target }) => {
        void addToWorkspace(item, target, true);
      }
    );

    type LauncherItemHandlerKey =
      | 'onCopyPath'
      | 'onCopyParentPath'
      | 'onOpenParentFolder'
      | 'onRunAsAdmin'
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
      cleanupAddCopyToWorkspace,
      window.electronAPI.onLauncherMenuCopyPath(createLauncherItemHandler('onCopyPath')),
      window.electronAPI.onLauncherMenuCopyParentPath(
        createLauncherItemHandler('onCopyParentPath')
      ),
      window.electronAPI.onLauncherMenuOpenParentFolder(
        createLauncherItemHandler('onOpenParentFolder')
      ),
      window.electronAPI.onLauncherMenuRunAsAdmin(createLauncherItemHandler('onRunAsAdmin')),
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
      window.electronAPI.onWindowMenuAddToWorkspace(
        async ({ windowInfo, includePosition, target }) => {
          // 開いているウィンドウへ切り替えるだけのパスの無い単一アイテム（exe のパスは使わない）
          const windowItem = windowInfoToPathlessItem(windowInfo, { includePosition });
          try {
            await window.electronAPI.workspaceAPI.addItem(
              windowItem,
              target.groupId,
              target.workspaceId
            );
            await window.electronAPI.showToastWindow({
              type: 'success',
              displayName: windowItem.displayName,
              itemType: 'workspaceAdd',
              icon: windowInfo.icon,
              message: includePosition
                ? t('launcher.messages.windowAddedWithPosition')
                : t('launcher.messages.windowAdded'),
            });
          } catch (error) {
            // 失敗は本体側がエラーのトーストで知らせる
            logError('ウィンドウのワークスペースへの追加に失敗しました:', error);
          }
        }
      ),
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
      ((isClipboardItem(item) || isSetItem(item)) && item.icon);

    if (customIcon) {
      return <img src={customIcon} alt="" width="24" height="24" />;
    }

    if (isWindowInfo(item)) {
      return '🪟';
    }

    // WSグループ: 窓の形で、上の帯（タイトルバー）だけをグループの色にする
    if (isWsGroupItem(item)) {
      return <WsGroupIcon color={item.color} />;
    }

    return ITEM_TYPE_ICONS[item.type] || '❓';
  }

  // ドラッグ&ドロップハンドラー（ワークスペースへの追加用）
  const handleDragStart = (e: React.DragEvent, item: AppItem, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'copy';

    if (isWindowInfo(item)) {
      // ウィンドウ検索結果は hwnd（bigint）を持ち JSON にできないので、先にパスの無い単一アイテムへ変換する。
      // 既定は切り替えだけ。位置（placement）は別データで渡し、ドロップ側が Ctrl 押下時だけ採用する
      e.dataTransfer.setData('launcherItem', JSON.stringify(windowInfoToPathlessItem(item)));
      e.dataTransfer.setData(
        'windowPosition',
        JSON.stringify(windowInfoToPathlessItem(item, { includePosition: true }).placement)
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
    // Shift+F10・アプリケーションキーで出したとき（ページが起こしたイベント）は、行の位置に出す
    const anchor = event.nativeEvent.isTrusted ? undefined : { x: event.clientX, y: event.clientY };

    const selection = latestRef.current.windowSelection;
    if (
      isWindowInfo(item) &&
      selection &&
      selection.markedCount >= 2 &&
      selection.isMarked(item.hwnd)
    ) {
      const desktopInfo = await window.electronAPI.getVirtualDesktopInfo();
      window.electronAPI.showWindowsContextMenu(selection.markedCount, desktopInfo, anchor);
      return;
    }

    if (isWindowInfo(item)) {
      const [desktopInfo, isPinned] = await Promise.all([
        window.electronAPI.getVirtualDesktopInfo(),
        window.electronAPI.isWindowPinned(item.hwnd),
      ]);
      window.electronAPI.showWindowContextMenu(item, desktopInfo, isPinned, anchor);
      return;
    }

    window.electronAPI.showLauncherContextMenu(item, anchor);
  };

  /** まとめて追加する入口（ブックマーク・アプリ・フォルダ取込）。空のタブと、検索でどこにも合わないときに出す */
  const renderImportButtons = (testId: string) =>
    onAddFolderImport && (
      <div className="item-list-empty-imports" data-testid={testId}>
        <Button
          variant="secondary"
          size="sm"
          onClick={openBookmarkImport}
          title={t('launcher.registerMenu.addBookmarks')}
        >
          {t('launcher.empty.importBookmarks')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={openAppImport}
          title={t('launcher.registerMenu.addApps')}
        >
          {t('launcher.empty.importApps')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onAddFolderImport}
          title={t('launcher.registerMenu.addFolderImport')}
        >
          {t('launcher.empty.importFolder')}
        </Button>
      </div>
    );

  return (
    <>
      <div
        className="item-list"
        ref={listRef}
        onContextMenu={(e) => {
          // アイテムの行は行の右クリックが受ける（stopPropagation 済み）。ここに来るのは余白・空のときの案内
          if (!onBlankContextMenu) return;
          e.preventDefault();
          onBlankContextMenu();
        }}
      >
        {items.length === 0 && emptyState && (
          <div className="item-list-empty" role="status">
            {emptyState.kind === 'noMatch' ? (
              <>
                <p>
                  {t(noMatchKeys(emptyState.windowMode, emptyState.elsewhere).title, {
                    query: emptyState.query,
                  })}
                </p>
                <p className="item-list-empty-hint">
                  {t(noMatchKeys(emptyState.windowMode, emptyState.elsewhere).hint)}
                  {/* 他のタブにあるときは、押すと Tab キーと同じく次のタブへ切り替えるリンクを添える */}
                  {emptyState.elsewhere === 'otherTab' && onSwitchTab && (
                    <span className="item-list-empty-key-hint">
                      Tab:
                      <button type="button" className="item-list-empty-link" onClick={onSwitchTab}>
                        {t('launcher.empty.switchTab')}
                      </button>
                    </span>
                  )}
                </p>
                {/* 通常の検索でどこにも合わないときは、そのまま登録・取込へ進めるようにする
                    （ほかのタブに合うときは「タブを切り替える」を先に見てもらうので出さない。A3-189） */}
                {!emptyState.windowMode && emptyState.elsewhere === null && (
                  <>
                    {onAddItem && (
                      <Button variant="secondary" size="sm" onClick={onAddItem}>
                        {t('launcher.empty.add')}
                      </Button>
                    )}
                    {renderImportButtons('no-match-imports')}
                  </>
                )}
              </>
            ) : emptyState.kind === 'corrupted' ? (
              <>
                <p>
                  {t('launcher.empty.corrupted', {
                    files: emptyState.files.join(t('common.listSeparator')),
                  })}
                </p>
                <p className="item-list-empty-hint">{t('launcher.empty.corruptedHint')}</p>
                {onOpenConfigFolder && (
                  <Button variant="secondary" size="sm" onClick={onOpenConfigFolder}>
                    {t('launcher.empty.openConfigFolder')}
                  </Button>
                )}
              </>
            ) : (
              <>
                <p>{t('launcher.empty.emptyTab')}</p>
                {onAddItem && (
                  <Button variant="secondary" size="sm" onClick={onAddItem}>
                    {t('launcher.empty.add')}
                  </Button>
                )}
                {/* まとめて追加する入口も見せる（初めての人が、取込があることに気づけるように。A3-172） */}
                {renderImportButtons('empty-tab-imports')}
              </>
            )}
          </div>
        )}
        <div className="item-list-inner" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const index = virtualRow.index;
            const item = items[index];
            const isWindow = isWindowInfo(item);
            const isSet = isSetItem(item);
            const isClipboard = isClipboardItem(item);
            const isWsGroup = isWsGroupItem(item);
            // WSグループはグループを開くだけで中身を持たないので、ワークスペースへドラッグさせない
            const isDraggable = !isWsGroupItem(item);
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
            } else {
              itemKey = `${itemName}-${index}`;
            }

            const classNames = [
              'item',
              index === selectedIndex && 'selected',
              isSet && 'group-item',
              isWindow && 'window-item',
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
                onMouseMove={(e) => handleItemMouseMove(e, index)}
                onContextMenu={(e) => handleContextMenu(e, item)}
                title={getTooltipText(item, nameOfItem)}
              >
                {isMarked && (
                  <span className="item-mark" aria-label={t('launcher.list.selected')}>
                    ✓
                  </span>
                )}
                <span className="item-icon">{getItemIcon(item)}</span>
                <span className="item-name">
                  {itemName}
                  {isSet && (
                    <span className="group-count">
                      {t('launcher.list.groupCount', { count: item.entries.length })}
                      {item.entries.some((entry) => entry.placement) && (
                        <span title={t('launcher.list.setPlacedBadge')}> 📍</span>
                      )}
                    </span>
                  )}
                  {isWsGroup && (
                    <span className="ws-group-badge" title={t('launcher.tooltip.wsGroup')}>
                      {t('launcher.list.wsGroupBadge')}
                    </span>
                  )}
                  {isLauncherItem(item) && hasItemWindowSwitch(item) && (
                    <span
                      className="window-title-badge"
                      title={t('launcher.list.windowSearchBadge', {
                        title: item.window?.title || item.window?.processName || '',
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
