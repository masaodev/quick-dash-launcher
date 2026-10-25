import React from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AppItem,
  Workspace,
  WorkspaceItem,
  WorkspaceGroupView,
  WorkspaceGroupUpdate,
  MixedChild,
  MixedOrderEntry,
  GroupDropZone,
  SetPlacement,
} from '@common/types';
import { PathUtils } from '@common/utils/pathUtils';
import { WORKSPACE_ITEM_DRAG_TYPE } from '@common/constants';
import { isLauncherItem } from '@common/types/guards';
import { describeWorkspaceItem } from '@common/utils/workspaceConverters';
import {
  canCreateSubgroup,
  getSubtreeMaxDepth,
  getGroupDepth,
  MAX_GROUP_DEPTH,
  type GroupTreeNode,
} from '@common/utils/groupTreeUtils';

import { useWorkspaceItemGroups } from '../hooks/workspace';
import { useLatestRef } from '../hooks/useLatestRef';
import { useWorkspaceAddNotice } from '../hooks/useWorkspaceAddNotice';
import { useItemActions } from '../hooks/useItemActions';
import { useToast } from '../hooks/useToast';
import { logError } from '../utils/debug';

import WorkspaceGroupHeader from './WorkspaceGroupHeader';
import WorkspaceItemCard from './WorkspaceItemCard';
import ColorPicker from './ColorPicker';
import MemoViewModal from './MemoViewModal';
import { Button } from './ui';

/**
 * カラーピッカーモーダル専用コンポーネント
 * モーダルオーバーレイとESCキー処理を担当
 */
const ColorPickerModal: React.FC<{
  currentColor?: string;
  onSelectColor: (color: string) => void;
  onClose: () => void;
}> = ({ currentColor, onSelectColor, onClose }) => {
  // ESCキー処理
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay-base" onClick={onClose} style={{ zIndex: 10000 }}>
      <div onClick={(e) => e.stopPropagation()}>
        <ColorPicker currentColor={currentColor} onSelectColor={onSelectColor} />
      </div>
    </div>
  );
};

/** 「すべて開く」で確かめてから開く件数 */
const OPEN_ALL_CONFIRM_THRESHOLD = 5;
/** 「すべて開く」で 1 件ずつあける間（ミリ秒） */
const OPEN_ALL_INTERVAL_MS = 300;

interface WorkspaceGroupedListProps {
  contentRef?: React.Ref<HTMLDivElement>;
  workspaces?: Workspace[];
  data: {
    groups: WorkspaceGroupView[];
    items: WorkspaceItem[];
  };
  handlers: {
    onLaunch: (item: WorkspaceItem) => void;
    onRemoveItem: (id: string) => void;
    onUpdateDisplayName: (id: string, displayName: string) => void;
    onEditItem: (item: WorkspaceItem) => void;
    onToggleGroup: (groupId: string) => void;
    onUpdateGroup: (groupId: string, updates: WorkspaceGroupUpdate) => void;
    onDeleteGroup: (groupId: string) => void;
    onArchiveGroup: (groupId: string) => void;
    onAddSubgroup: (parentGroupId: string, subgroupCount: number) => void;
    onDuplicateItem: (sourceItemId: string, targetGroupId?: string, insertOrder?: number) => void;
    onMoveItemToGroup: (itemId: string, groupId: string) => void;
    onMoveGroupToParent: (groupId: string, newParentGroupId?: string) => void;
    onReorderMixed: (parentGroupId: string | undefined, entries: MixedOrderEntry[]) => void;
    onNativeFileDrop?: (e: React.DragEvent, groupId?: string) => Promise<void>;
    onDetachGroup?: (groupId: string, screenX: number, screenY: number) => void;
    /** 余白の右クリック（未指定なら何も出さない。アーカイブ・切り離しウィンドウでは渡さない） */
    onBlankContextMenu?: () => void;
    /** グループの右クリック「ほかのグループを折りたたむ」（未指定なら何もしない。切り離しウィンドウでは出さない） */
    onCollapseOtherGroups?: (groupId: string) => void;
    /** 空のワークスペースの［＋ グループを追加］（未指定ならボタンを出さない） */
    onAddGroup?: () => void;
  };
  ui: {
    editingItemId: string | null;
    setEditingItemId: (id: string | null) => void;
    activeGroupId?: string;
    setActiveGroupId: (id: string | undefined) => void;
    activeWorkspaceId?: string;
    visibleGroupIds?: Set<string> | null;
    itemVisibility?: Map<string, boolean> | null;
    /** アーカイブタブの表示中（グループの右クリックは復元・完全削除だけ） */
    isArchiveMode?: boolean;
    /** 切り離しウィンドウで表示しているグループ（その見出しを掴むとウィンドウが動く） */
    detachedRootGroupId?: string;
  };
}

const WorkspaceGroupedList: React.FC<WorkspaceGroupedListProps> = ({
  contentRef,
  workspaces,
  data,
  handlers,
  ui,
}) => {
  const { t } = useTranslation();
  const { copyToClipboard } = useItemActions();
  // ドロップで足したものは、ワークスペースの中のトーストで知らせる（貼り付けと同じ）
  const announceAdded = useWorkspaceAddNotice(data.groups, handlers.onToggleGroup);
  const { showSuccess, showError } = useToast();
  const { groups, items } = data;
  const {
    onLaunch,
    onRemoveItem,
    onUpdateDisplayName,
    onEditItem,
    onToggleGroup,
    onUpdateGroup,
    onDeleteGroup,
    onArchiveGroup,
    onAddSubgroup,
    onDuplicateItem,
    onMoveItemToGroup,
    onMoveGroupToParent,
    onReorderMixed,
    onNativeFileDrop,
    onDetachGroup,
    onBlankContextMenu,
    onAddGroup,
    onCollapseOtherGroups,
  } = handlers;
  const {
    editingItemId,
    setEditingItemId,
    activeGroupId,
    setActiveGroupId,
    activeWorkspaceId,
    visibleGroupIds,
    itemVisibility,
    isArchiveMode,
    detachedRootGroupId,
  } = ui;

  const [draggedElement, setDraggedElement] = React.useState<{
    id: string;
    kind: 'item' | 'group';
  } | null>(null);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [colorPickerGroupId, setColorPickerGroupId] = React.useState<string | null>(null);
  const [memoItem, setMemoItem] = React.useState<WorkspaceItem | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = React.useState<string | null>(null);
  const dragOverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { itemsByGroup, groupTree, mixedChildrenByGroup } = useWorkspaceItemGroups(items, groups);

  const itemsMap = React.useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const nameOfWorkspaceItem = React.useCallback(
    (itemId: string) => itemsMap.get(itemId)?.displayName,
    [itemsMap]
  );

  const groupsMap = React.useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups]
  );

  const handlePathOperation = React.useCallback(
    async (
      item: WorkspaceItem,
      operation: 'copy' | 'open',
      pathType: 'item' | 'parent',
      useOriginalPath = false
    ) => {
      if (item.type !== 'item') return;
      const basePath = useOriginalPath ? item.originalPath : item.path;
      if (!basePath) return;

      const targetPath = pathType === 'parent' ? PathUtils.getParentPath(basePath) : basePath;

      if (operation === 'copy') {
        // メインウィンドウと同じく、画面の右下に「コピーしました」を出す
        const target = useOriginalPath
          ? pathType === 'parent'
            ? 'shortcutParentPath'
            : 'shortcutPath'
          : pathType === 'parent'
            ? 'parentPath'
            : 'path';
        await copyToClipboard(targetPath, target);
      } else {
        await window.electronAPI.openFolder(targetPath);
      }
    },
    [copyToClipboard]
  );

  // コンテキストメニューの購読は一度だけ張り、ハンドラーの中で最新の値を読む
  const latest = useLatestRef({
    itemsMap,
    groupsMap,
    groups,
    itemsByGroup,
    setEditingItemId,
    onMoveItemToGroup,
    onRemoveItem,
    onEditItem,
    onArchiveGroup,
    onDeleteGroup,
    onAddSubgroup,
    onLaunch,
    onCollapseOtherGroups,
    showSuccess,
    showError,
    t,
  });

  React.useEffect(() => {
    const withItem = (fn: (item: WorkspaceItem) => void) => (itemId: string) => {
      const item = latest.current.itemsMap.get(itemId);
      if (item) fn(item);
    };

    const cleanups = [
      window.electronAPI.onWorkspaceMenuRenameItem((itemId) =>
        latest.current.setEditingItemId(itemId)
      ),
      window.electronAPI.onWorkspaceMenuEditItem(
        withItem((item) => latest.current.onEditItem(item))
      ),
      window.electronAPI.onWorkspaceMenuShowMemo(withItem(setMemoItem)),
      window.electronAPI.onWorkspaceMenuCopyPath(
        withItem((item) => handlePathOperation(item, 'copy', 'item'))
      ),
      window.electronAPI.onWorkspaceMenuCopyParentPath(
        withItem((item) => handlePathOperation(item, 'copy', 'parent'))
      ),
      window.electronAPI.onWorkspaceMenuOpenParentFolder(
        withItem((item) => handlePathOperation(item, 'open', 'parent'))
      ),
      window.electronAPI.onWorkspaceMenuCopyShortcutPath(
        withItem((item) => handlePathOperation(item, 'copy', 'item', true))
      ),
      window.electronAPI.onWorkspaceMenuCopyShortcutParentPath(
        withItem((item) => handlePathOperation(item, 'copy', 'parent', true))
      ),
      window.electronAPI.onWorkspaceMenuOpenShortcutParentFolder(
        withItem((item) => handlePathOperation(item, 'open', 'parent', true))
      ),
      window.electronAPI.onWorkspaceMenuRemoveItem((itemId) => latest.current.onRemoveItem(itemId)),
      window.electronAPI.onWorkspaceMenuMoveToGroup((itemId, groupId) =>
        latest.current.onMoveItemToGroup(itemId, groupId)
      ),
      window.electronAPI.onWorkspaceMenuMoveToWorkspace(
        async (itemId, targetWorkspaceId, groupId) => {
          try {
            await window.electronAPI.workspaceAPI.moveItemToWorkspace(
              itemId,
              targetWorkspaceId,
              groupId
            );
          } catch (error) {
            logError('Failed to move item to workspace:', error);
          }
        }
      ),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [latest, handlePathOperation]);

  React.useEffect(() => {
    const cleanups = [
      window.electronAPI.onWorkspaceGroupMenuRename(setEditingGroupId),
      window.electronAPI.onWorkspaceGroupMenuShowColorPicker(setColorPickerGroupId),
      window.electronAPI.onWorkspaceGroupMenuCopyAsText((groupId) => {
        const { groupsMap, itemsByGroup, showSuccess, showError, t } = latest.current;
        const group = groupsMap.get(groupId);
        if (group) {
          const groupItems = itemsByGroup[groupId] || [];
          let text = `【${group.displayName}】\r\n`;
          /* eslint-disable no-irregular-whitespace */
          groupItems.forEach((item, index) => {
            text += `　■${item.displayName}\r\n`;
            text += `　　${describeWorkspaceItem(item, t)}\r\n`;
            if (index < groupItems.length - 1) {
              text += '\r\n';
            }
          });
          /* eslint-enable no-irregular-whitespace */
          const name = group.displayName;
          window.electronAPI
            .copyToClipboard(text)
            .then(() => showSuccess(t('workspace.groups.copiedAsText', { name })))
            .catch((error: unknown) => {
              logError('Failed to copy group as text:', error);
              showError(t('workspace.groups.copyAsTextFailed', { name }));
            });
        }
      }),
      window.electronAPI.onWorkspaceGroupMenuArchive((groupId) =>
        latest.current.onArchiveGroup(groupId)
      ),
      window.electronAPI.onWorkspaceGroupMenuDelete((groupId) =>
        latest.current.onDeleteGroup(groupId)
      ),
      window.electronAPI.onWorkspaceGroupMenuAddSubgroup((parentGroupId) => {
        const { groups, onAddSubgroup } = latest.current;
        const childCount = groups.filter((g) => g.parentGroupId === parentGroupId).length;
        onAddSubgroup(parentGroupId, childCount);
      }),
      window.electronAPI.onWorkspaceGroupMenuAddFromMain((groupId) => {
        window.electronAPI.workspaceAPI.openItemPicker(groupId).catch((error) => {
          logError('Failed to open item picker:', error);
        });
      }),
      window.electronAPI.onWorkspaceGroupMenuAddNew((groupId) => {
        window.electronAPI.workspaceAPI.openNewItemEditor(groupId).catch((error) => {
          logError('Failed to open new item editor:', error);
        });
      }),
      window.electronAPI.onWorkspaceGroupMenuOpenAll((groupId) => {
        void openAllInGroup(groupId);
      }),
      window.electronAPI.onWorkspaceGroupMenuDuplicate((groupId) => {
        const { groupsMap, t } = latest.current;
        const name = groupsMap.get(groupId)?.displayName ?? '';
        window.electronAPI.workspaceAPI
          .duplicateGroup(groupId, t('workspace.groups.copyName', { name }))
          .catch((error) => logError('Failed to duplicate group:', error));
      }),
      window.electronAPI.onWorkspaceGroupMenuCollapseOthers((groupId) =>
        latest.current.onCollapseOtherGroups?.(groupId)
      ),
      window.electronAPI.onWorkspaceGroupMenuMoveToWorkspace(async (groupId, targetWorkspaceId) => {
        try {
          await window.electronAPI.workspaceAPI.moveGroupToWorkspace(groupId, targetWorkspaceId);
        } catch (error) {
          logError('Failed to move group to workspace:', error);
        }
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [latest]);

  /**
   * グループの右クリック「すべて開く」: グループのアイテムを、サブグループの中も含めて並び順に開く。
   * 5 件以上なら確かめてから開く。元が見つからない参照は飛ばす
   */
  async function openAllInGroup(groupId: string): Promise<void> {
    const { groups, groupsMap, itemsByGroup, onLaunch, t } = latest.current;
    const collect = (id: string): WorkspaceItem[] => [
      ...(itemsByGroup[id] || []),
      ...groups
        .filter((g) => g.parentGroupId === id)
        .sort((a, b) => a.order - b.order)
        .flatMap((g) => collect(g.id)),
    ];
    const targets = collect(groupId).filter((item) => item.type !== 'ref');
    const name = groupsMap.get(groupId)?.displayName ?? '';
    if (targets.length === 0) {
      await window.electronAPI.showToastWindow({
        type: 'info',
        message: t('workspace.groups.openAllEmpty', { name }),
      });
      return;
    }
    if (targets.length >= OPEN_ALL_CONFIRM_THRESHOLD) {
      const result = await window.electronAPI.workspaceAPI.openConfirm({
        title: t('workspace.groups.openAllTitle'),
        message: t('workspace.groups.openAllConfirm', { name, count: targets.length }),
        confirmText: t('workspace.groups.openAll'),
        cancelText: t('common.cancel'),
      });
      if (!result) return;
    }
    for (const [index, item] of targets.entries()) {
      // 立て続けに開くとアプリの起動が重なって前後するので、少し間をあける
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, OPEN_ALL_INTERVAL_MS));
      onLaunch(item);
    }
  }

  /** Shift+クリックで親フォルダを開けるアイテムか（ファイル・フォルダ・アプリ） */
  const hasParentFolder = (item: WorkspaceItem): boolean =>
    item.type === 'item' &&
    item.launcherType !== 'url' &&
    item.launcherType !== 'customUri' &&
    item.launcherType !== 'windowSwitch';

  /** グループヘッダーの dragEnd でウィンドウ外ドロップを検出（サブグループは切り離さない） */
  const handleGroupDragEndForDetach = (e: React.DragEvent, groupId: string) => {
    if (!onDetachGroup || groupsMap.get(groupId)?.parentGroupId) return;
    // dropEffect === 'none' はどのドロップターゲットにも受け入れられなかったことを示す
    if (e.dataTransfer.dropEffect === 'none') {
      onDetachGroup(groupId, e.screenX, e.screenY);
    }
  };

  const handleMixedDragStart = (id: string, kind: 'item' | 'group') => (e: React.DragEvent) => {
    setDraggedElement({ id, kind });
    e.dataTransfer.effectAllowed = kind === 'item' ? 'copyMove' : 'move';
    e.dataTransfer.setData('itemId', kind === 'item' ? id : '');
    e.dataTransfer.setData('groupId', kind === 'group' ? id : '');

    // ドラッグ元の現在の親グループIDを記録（グループ間移動判定に使用）
    if (kind === 'item') {
      const item = itemsMap.get(id);
      e.dataTransfer.setData('currentGroupId', item?.groupId || '');
      // メインウィンドウに落とすと、このアイテムを初期値にして登録画面を開く（別のウィンドウなので ID では引けない）
      if (item) e.dataTransfer.setData(WORKSPACE_ITEM_DRAG_TYPE, JSON.stringify(item));
    } else {
      e.dataTransfer.setData('currentParentGroupId', groupsMap.get(id)?.parentGroupId || '');
    }
  };

  const handleMixedDragEnd = () => {
    setDraggedElement(null);
  };

  const handleMixedDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedElement) {
      e.dataTransfer.dropEffect = draggedElement.kind === 'item' && e.ctrlKey ? 'copy' : 'move';
    }
  };

  /**
   * グループをターゲットのネスト先に移動できるかチェック
   * ドラッグ元のサブツリー深さ + ターゲットの深さが制限を超えないか確認
   */
  const canNestGroup = React.useCallback(
    (draggedGroupId: string, targetGroupId: string): boolean => {
      // ターゲットがサブグループを作成可能か
      if (!canCreateSubgroup(targetGroupId, groups)) return false;
      // ドラッグ元のサブツリー深さを考慮
      const targetDepth = getGroupDepth(targetGroupId, groups);
      const draggedSubtreeDepth = getSubtreeMaxDepth(draggedGroupId, groups);
      return targetDepth + 1 + draggedSubtreeDepth <= MAX_GROUP_DEPTH;
    },
    [groups]
  );

  /** MixedChildからMixedOrderEntryへ変換 */
  const toMixedEntry = (child: MixedChild): MixedOrderEntry =>
    child.kind === 'group'
      ? { id: child.group.id, kind: 'group' }
      : { id: child.item.id, kind: 'item' };

  /** 親グループIDに応じた並べ替え対象のentries一覧を構築 */
  const buildEntries = (
    parentGroupId: string | undefined,
    dragKind: 'item' | 'group'
  ): MixedOrderEntry[] => {
    if (parentGroupId) {
      return (mixedChildrenByGroup[parentGroupId] || []).map(toMixedEntry);
    }
    // トップレベルに並ぶのはグループだけ（アイテムはどれかのグループに入る。A3-157）
    return dragKind === 'group'
      ? groupTree.map((node) => ({ id: node.group.id, kind: 'group' as const }))
      : [];
  };

  /**
   * 配列内の要素を移動する
   * @param zone 'before' = ターゲットの前, 'after' = ターゲットの後, undefined = ターゲット位置
   */
  const reorderEntries = (
    entries: MixedOrderEntry[],
    fromIndex: number,
    toIndex: number,
    zone?: 'before' | 'after'
  ): MixedOrderEntry[] => {
    const result = [...entries];
    const [moved] = result.splice(fromIndex, 1);
    // splice後、fromIndex < toIndex なら toIndex が1つ前にずれる
    const adjusted = fromIndex < toIndex ? toIndex - 1 : toIndex;
    const insertAt = zone === 'after' ? adjusted + 1 : adjusted;
    result.splice(insertAt, 0, moved);
    return result;
  };

  /** 混在ドロップハンドラー: ドロップゾーンに応じて並べ替えまたはネスト */
  const handleMixedDrop =
    (
      targetId: string,
      targetKind: 'item' | 'group',
      parentGroupId: string | undefined,
      dropZone?: GroupDropZone
    ) =>
    (e: React.DragEvent) => {
      e.preventDefault();

      if (!draggedElement || draggedElement.id === targetId) {
        setDraggedElement(null);
        return;
      }

      // Ctrl+アイテムドラッグ: コピー操作
      if (draggedElement.kind === 'item' && e.ctrlKey) {
        e.stopPropagation();
        let copyTargetGroupId: string | undefined;
        let insertOrder: number | undefined;

        if (targetKind === 'group' && dropZone === 'nest') {
          copyTargetGroupId = targetId;
        } else {
          copyTargetGroupId = parentGroupId;
          if (targetKind === 'item') {
            insertOrder = itemsMap.get(targetId)?.order;
          } else if (targetKind === 'group') {
            const targetOrder = groupsMap.get(targetId)?.order;
            if (targetOrder !== undefined) {
              insertOrder = dropZone === 'after' ? targetOrder + 1 : targetOrder;
            }
          }
        }

        onDuplicateItem(draggedElement.id, copyTargetGroupId, insertOrder);
        setDraggedElement(null);
        return;
      }

      // グループヘッダーへのドロップでゾーン指定がある場合
      if (targetKind === 'group' && dropZone) {
        e.stopPropagation();

        if (dropZone === 'nest') {
          if (draggedElement.kind === 'group') {
            onMoveGroupToParent(draggedElement.id, targetId);
          } else {
            // アイテムをターゲットグループに移動
            onMoveItemToGroup(draggedElement.id, targetId);
          }
          setDraggedElement(null);
          return;
        }

        // before/after: 並べ替え処理
        const draggedParentGroupId =
          draggedElement.kind === 'group'
            ? groupsMap.get(draggedElement.id)?.parentGroupId
            : itemsMap.get(draggedElement.id)?.groupId;

        if (draggedParentGroupId !== parentGroupId) {
          if (draggedElement.kind === 'group') {
            onMoveGroupToParent(draggedElement.id, parentGroupId);
          } else if (parentGroupId) {
            // トップレベルのグループの前後はアイテムの置き場ではない（グループの外には置けない）
            onMoveItemToGroup(draggedElement.id, parentGroupId);
          }
          setDraggedElement(null);
          return;
        }

        const entries = buildEntries(parentGroupId, draggedElement.kind);
        const draggedIndex = entries.findIndex(
          (e) => e.id === draggedElement.id && e.kind === draggedElement.kind
        );
        const targetIndex = entries.findIndex((e) => e.id === targetId && e.kind === 'group');

        if (draggedIndex === -1 || targetIndex === -1) {
          setDraggedElement(null);
          return;
        }

        onReorderMixed(parentGroupId, reorderEntries(entries, draggedIndex, targetIndex, dropZone));
        setDraggedElement(null);
        return;
      }

      // アイテムドラッグまたはゾーン指定なし: 従来の並べ替え処理
      const draggedParentGroupId =
        draggedElement.kind === 'item'
          ? itemsMap.get(draggedElement.id)?.groupId
          : groupsMap.get(draggedElement.id)?.parentGroupId;

      // 異なる親からのドラッグは伝播させ、handleGroupDrop でグループ間移動として処理
      if (draggedParentGroupId !== parentGroupId) {
        return;
      }

      e.stopPropagation();

      const entries = buildEntries(parentGroupId, draggedElement.kind);
      const draggedIndex = entries.findIndex(
        (e) => e.id === draggedElement.id && e.kind === draggedElement.kind
      );
      const targetIndex = entries.findIndex((e) => e.id === targetId && e.kind === targetKind);

      if (draggedIndex === -1 || targetIndex === -1) {
        setDraggedElement(null);
        return;
      }

      const zone = dropZone === 'before' || dropZone === 'after' ? dropZone : undefined;
      onReorderMixed(parentGroupId, reorderEntries(entries, draggedIndex, targetIndex, zone));
      setDraggedElement(null);
    };

  /** ネイティブファイル/URLドラッグかどうかを判定 */
  const isNativeFileDrag = (e: React.DragEvent): boolean => {
    const types = e.dataTransfer.types;
    return (
      types.includes('Files') ||
      (types.includes('text/uri-list') && !types.includes('itemid')) ||
      (types.includes('text/plain') && !types.includes('itemid') && !types.includes('launcheritem'))
    );
  };

  const handleGroupDragOver = (groupId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const isNative = isNativeFileDrag(e);
    const isCopy =
      isNative ||
      e.dataTransfer.types.includes('launcheritem') ||
      (draggedElement?.kind === 'item' && e.ctrlKey);

    e.dataTransfer.dropEffect = isCopy ? 'copy' : 'move';

    // ワークスペース内アイテム並び替え以外はハイライト表示
    if (isCopy) {
      setDragOverGroupId(groupId);
      // dragoverは継続発火するため、タイマーでリセット
      if (dragOverTimerRef.current) {
        clearTimeout(dragOverTimerRef.current);
      }
      dragOverTimerRef.current = setTimeout(() => {
        setDragOverGroupId(null);
      }, 150);
    }
  };

  /**
   * AppItem（LauncherItem/SetItem/ClipboardItem）をワークスペースに追加
   *
   * 既定はメインウィンドウのアイテムの参照で、Ctrl を押してドロップしたときはコピー（エクスプローラーの Ctrl と同じ）。
   * ウィンドウ検索結果は送り側でパスの無い単一アイテム（exe 名＋タイトル）に変換済み（もともとコピー）。
   * windowPosition（placement）が付いていて Ctrl を押してドロップしたときだけ、今の位置・サイズも記録する
   */
  async function addAppItemToWorkspace(
    appItemData: string,
    groupId: string,
    windowPositionData?: string,
    ctrlKey = false
  ): Promise<void> {
    let item: AppItem = JSON.parse(appItemData);
    let withPosition = false;
    if (ctrlKey && windowPositionData && isLauncherItem(item) && item.type === 'windowSwitch') {
      item = { ...item, placement: JSON.parse(windowPositionData) as SetPlacement };
      withPosition = true;
    }
    await window.electronAPI.workspaceAPI.addItem(
      item,
      groupId,
      activeWorkspaceId,
      ctrlKey && !withPosition ? { copy: true } : undefined
    );
    // 型安全のためinチェックを使用（WindowInfo は来ない）
    announceAdded(
      ['displayName' in item ? item.displayName : ''],
      groupId,
      withPosition ? t('workspace.restoresPosition') : undefined
    );
  }

  const handleGroupDrop = (groupId: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverGroupId(null);

    // ネイティブファイル/URLドロップの処理
    if (isNativeFileDrag(e) && onNativeFileDrop) {
      // documentレベルのハンドラーに処理済みフラグを設定
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (e.nativeEvent as any).__handledByGroup = true;
      await onNativeFileDrop(e, groupId);
      setDraggedElement(null);
      return;
    }

    const itemId = e.dataTransfer.getData('itemId');
    const currentGroupId = e.dataTransfer.getData('currentGroupId');
    const draggedGroupId = e.dataTransfer.getData('groupId');
    const currentParentGroupId = e.dataTransfer.getData('currentParentGroupId');
    const launcherItemData = e.dataTransfer.getData('launcherItem');
    const windowPositionData = e.dataTransfer.getData('windowPosition');

    // dataTransferは未設定値を空文字列で返すため、groupId(undefined)と比較する際に正規化
    const normalizeGroupId = (id: string): string | undefined => id || undefined;

    try {
      // Ctrl+アイテムドラッグ: コピー操作
      if (draggedElement?.kind === 'item' && e.ctrlKey) {
        onDuplicateItem(draggedElement.id, groupId);
        setDraggedElement(null);
        return;
      }

      if (launcherItemData) {
        // ランチャーからのアイテム追加（ウィンドウ検索結果は Ctrl+ドロップで位置も記録）
        await addAppItemToWorkspace(launcherItemData, groupId, windowPositionData, e.ctrlKey);
      } else if (
        draggedGroupId &&
        draggedGroupId !== groupId &&
        normalizeGroupId(currentParentGroupId) !== groupId
      ) {
        // グループを別の親グループに移動
        onMoveGroupToParent(draggedGroupId, groupId);
      } else if (itemId && normalizeGroupId(currentGroupId) !== groupId) {
        // アイテムを別のグループに移動
        onMoveItemToGroup(itemId, groupId);
      }
    } catch (error) {
      // 失敗は本体側がエラーのトーストで知らせる
      logError('ワークスペースへのアイテム追加に失敗:', error);
    }

    setDraggedElement(null);
  };

  const handleContextMenu = (item: WorkspaceItem) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.electronAPI.showWorkspaceContextMenu(item, groups, workspaces);
  };

  const handleGroupContextMenu = (group: WorkspaceGroupView) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const canAdd = canCreateSubgroup(group.id, groups);
    window.electronAPI.showWorkspaceGroupContextMenu(group, canAdd, workspaces, isArchiveMode);
  };

  const handleGroupToggle = (groupId: string) => {
    onToggleGroup(groupId);
  };

  /** 子ノードのマップ（renderGroupNode内でサブグループ再帰用） */
  const childNodeMap = React.useMemo(() => {
    const map = new Map<string, GroupTreeNode<WorkspaceGroupView>>();
    const buildMap = (nodes: GroupTreeNode<WorkspaceGroupView>[]) => {
      for (const node of nodes) {
        map.set(node.group.id, node);
        buildMap(node.children);
      }
    };
    buildMap(groupTree);
    return map;
  }, [groupTree]);

  /** アイテムの行（groupId は親のグループ。未分類なら省く） */
  const renderItemCard = (item: WorkspaceItem, groupId?: string): React.ReactNode => (
    <WorkspaceItemCard
      nameOfItem={nameOfWorkspaceItem}
      key={item.id}
      item={item}
      isEditing={editingItemId === item.id}
      draggedElement={draggedElement}
      onLaunch={onLaunch}
      onRemove={onRemoveItem}
      onUpdateDisplayName={onUpdateDisplayName}
      onStartEdit={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
      onDragStart={handleMixedDragStart(item.id, 'item')}
      onDragEnd={handleMixedDragEnd}
      onDragOver={handleMixedDragOver}
      onDrop={(e, zone) => handleMixedDrop(item.id, 'item', groupId, zone)(e)}
      onContextMenu={handleContextMenu(item)}
      onOpenParentFolder={
        hasParentFolder(item)
          ? (target) => void handlePathOperation(target, 'open', 'parent')
          : undefined
      }
    />
  );

  /** 再帰的にグループツリーノードをレンダリング（混在表示対応） */
  const renderGroupNode = (node: GroupTreeNode<WorkspaceGroupView>): React.ReactNode => {
    if (visibleGroupIds && !visibleGroupIds.has(node.group.id)) {
      return null;
    }

    const groupItems = (itemsByGroup[node.group.id] || []).filter(
      (item) => !itemVisibility || itemVisibility.get(item.id) !== false
    );
    if (itemVisibility && groupItems.length === 0 && node.children.length === 0) {
      const hasVisibleDescendant = node.children.some(
        (child) => visibleGroupIds && visibleGroupIds.has(child.group.id)
      );
      if (!hasVisibleDescendant) return null;
    }

    const mixed = mixedChildrenByGroup[node.group.id] || [];
    // フィルタ適用: アイテムの可視性を反映
    const filteredMixed = itemVisibility
      ? mixed.filter(
          (child) => child.kind === 'group' || itemVisibility.get(child.item.id) !== false
        )
      : mixed;

    return (
      <div
        key={node.group.id}
        className={`workspace-group workspace-group-depth-${node.depth}${dragOverGroupId === node.group.id ? ' drag-over' : ''}`}
        // 見出しやグループの中のアイテムをクリックしたグループを貼り付け先にする（入れ子は内側が後に呼ばれて勝つ）
        onClickCapture={() => setActiveGroupId(node.group.id)}
        onDragOver={handleGroupDragOver(node.group.id)}
        onDrop={handleGroupDrop(node.group.id)}
      >
        <WorkspaceGroupHeader
          group={node.group}
          itemCount={groupItems.length}
          isEditing={editingGroupId === node.group.id}
          isWindowHandle={node.group.id === detachedRootGroupId}
          isPasteTarget={!isArchiveMode && activeGroupId === node.group.id}
          depth={node.depth}
          draggedElement={draggedElement}
          canNest={
            draggedElement?.kind === 'group'
              ? canNestGroup(draggedElement.id, node.group.id)
              : draggedElement?.kind === 'item'
          }
          onToggle={handleGroupToggle}
          onUpdate={onUpdateGroup}
          onEndEdit={() => setEditingGroupId(null)}
          onGroupDragStart={handleMixedDragStart(node.group.id, 'group')}
          onGroupDragEnd={handleGroupDragEndForDetach}
          onGroupDragOverForReorder={handleMixedDragOver}
          onGroupDropForReorder={(e, dropZone) =>
            handleMixedDrop(node.group.id, 'group', node.group.parentGroupId, dropZone)(e)
          }
          onContextMenu={handleGroupContextMenu(node.group)}
        />
        {!node.group.collapsed && (
          <div className="workspace-group-mixed-children">
            {filteredMixed.map((child) => {
              if (child.kind === 'group') {
                const childNode = childNodeMap.get(child.group.id);
                if (!childNode) return null;
                if (visibleGroupIds && !visibleGroupIds.has(child.group.id)) return null;
                return renderGroupNode(childNode);
              }
              return renderItemCard(child.item, node.group.id);
            })}
          </div>
        )}
      </div>
    );
  };

  // 余白の右クリック。アイテム・グループの右クリックはそれぞれが受けて preventDefault 済み
  const handleBlankContextMenu = (e: React.MouseEvent) => {
    if (!onBlankContextMenu || e.defaultPrevented) return;
    e.preventDefault();
    onBlankContextMenu();
  };

  // アイテムが1つもない場合
  if (items.length === 0 && groups.length === 0) {
    return (
      <div className="workspace-empty" onContextMenu={handleBlankContextMenu}>
        <p>{t('workspace.empty.title')}</p>
        <p className="workspace-empty-hint">{t('workspace.empty.hint')}</p>
        {onAddGroup && (
          <Button variant="secondary" size="sm" onClick={onAddGroup}>
            {t('workspace.empty.addGroup')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="workspace-item-list" onContextMenu={handleBlankContextMenu}>
      <div ref={contentRef} className="workspace-item-list-content">
        {/* ツリー構造でグループをレンダリング */}
        {groupTree.map((node) => renderGroupNode(node))}

        {/* カラーピッカー */}
        {colorPickerGroupId && (
          <ColorPickerModal
            currentColor={groupsMap.get(colorPickerGroupId)?.color}
            onSelectColor={(color) => {
              onUpdateGroup(colorPickerGroupId, { color });
              setColorPickerGroupId(null);
            }}
            onClose={() => setColorPickerGroupId(null)}
          />
        )}

        <MemoViewModal
          isOpen={memoItem !== null}
          onClose={() => setMemoItem(null)}
          itemName={memoItem?.displayName || ''}
          memo={memoItem?.memo || ''}
        />
      </div>
    </div>
  );
};

export default WorkspaceGroupedList;
