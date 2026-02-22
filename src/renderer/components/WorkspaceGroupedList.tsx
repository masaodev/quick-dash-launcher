import React from 'react';
import type {
  AppItem,
  WorkspaceItem,
  WorkspaceGroup,
  MixedChild,
  MixedOrderEntry,
  GroupDropZone,
} from '@common/types';
import { PathUtils } from '@common/utils/pathUtils';
import {
  canCreateSubgroup,
  getSubtreeMaxDepth,
  getGroupDepth,
  MAX_GROUP_DEPTH,
  type GroupTreeNode,
} from '@common/utils/groupTreeUtils';

import { useWorkspaceItemGroups } from '../hooks/workspace';
import { logError } from '../utils/debug';

import WorkspaceGroupHeader from './WorkspaceGroupHeader';
import WorkspaceItemCard from './WorkspaceItemCard';
import ColorPicker from './ColorPicker';

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
        <ColorPicker
          currentColor={currentColor}
          onSelectColor={onSelectColor}
          onClose={onClose}
          disableEventListeners={true}
        />
      </div>
    </div>
  );
};

interface WorkspaceGroupedListProps {
  contentRef?: React.Ref<HTMLDivElement>;
  data: {
    groups: WorkspaceGroup[];
    items: WorkspaceItem[];
  };
  handlers: {
    onLaunch: (item: WorkspaceItem) => void;
    onRemoveItem: (id: string) => void;
    onUpdateDisplayName: (id: string, displayName: string) => void;
    onEditItem: (item: WorkspaceItem) => void;
    onToggleGroup: (groupId: string) => void;
    onUpdateGroup: (groupId: string, updates: Partial<WorkspaceGroup>) => void;
    onDeleteGroup: (groupId: string) => void;
    onArchiveGroup: (groupId: string) => void;
    onAddSubgroup: (parentGroupId: string, subgroupCount: number) => void;
    onMoveItemToGroup: (itemId: string, groupId?: string) => void;
    onMoveGroupToParent: (groupId: string, newParentGroupId?: string) => void;
    onReorderMixed: (parentGroupId: string | undefined, entries: MixedOrderEntry[]) => void;
    onNativeFileDrop?: (e: React.DragEvent, groupId?: string) => Promise<void>;
    onDetachGroup?: (groupId: string, screenX: number, screenY: number) => void;
  };
  ui: {
    editingItemId: string | null;
    setEditingItemId: (id: string | null) => void;
    uncategorizedCollapsed: boolean;
    onToggleUncategorized: () => void;
    activeGroupId?: string;
    setActiveGroupId: (id: string | undefined) => void;
    visibleGroupIds?: Set<string> | null;
    itemVisibility?: Map<string, boolean> | null;
    showUncategorized?: boolean;
  };
}

const WorkspaceGroupedList: React.FC<WorkspaceGroupedListProps> = ({
  contentRef,
  data,
  handlers,
  ui,
}) => {
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
    onMoveItemToGroup,
    onMoveGroupToParent,
    onReorderMixed,
    onNativeFileDrop,
    onDetachGroup,
  } = handlers;
  const {
    editingItemId,
    setEditingItemId,
    uncategorizedCollapsed,
    onToggleUncategorized,
    setActiveGroupId,
    visibleGroupIds,
    itemVisibility,
    showUncategorized = true,
  } = ui;

  const [draggedElement, setDraggedElement] = React.useState<{
    id: string;
    kind: 'item' | 'group';
  } | null>(null);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [colorPickerGroupId, setColorPickerGroupId] = React.useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = React.useState<string | null>(null);
  const dragOverTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { itemsByGroup, uncategorizedItems, groupTree, mixedChildrenByGroup } =
    useWorkspaceItemGroups(items, groups);

  const itemsMap = React.useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const groupsMap = React.useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups]
  );

  const filteredUncategorizedItems = React.useMemo(
    () =>
      uncategorizedItems.filter((item) => !itemVisibility || itemVisibility.get(item.id) !== false),
    [uncategorizedItems, itemVisibility]
  );

  const handlePathOperation = React.useCallback(
    async (
      item: WorkspaceItem,
      operation: 'copy' | 'open',
      pathType: 'item' | 'parent',
      useOriginalPath = false
    ) => {
      const basePath = useOriginalPath ? item.originalPath : item.path;
      if (!basePath) return;

      const targetPath = pathType === 'parent' ? PathUtils.getParentPath(basePath) : basePath;

      if (operation === 'copy') {
        window.electronAPI.copyToClipboard(targetPath);
      } else {
        await window.electronAPI.openExternalUrl(`file:///${targetPath}`);
      }
    },
    []
  );

  React.useEffect(() => {
    const withItem = (fn: (item: WorkspaceItem) => void) => (itemId: string) => {
      const item = itemsMap.get(itemId);
      if (item) fn(item);
    };

    const cleanups = [
      window.electronAPI.onWorkspaceMenuRenameItem(setEditingItemId),
      window.electronAPI.onWorkspaceMenuEditItem(withItem(onEditItem)),
      window.electronAPI.onWorkspaceMenuLaunchItem(withItem(onLaunch)),
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
      window.electronAPI.onWorkspaceMenuRemoveFromGroup(
        withItem((item) => {
          if (item.groupId) onMoveItemToGroup(item.id, undefined);
        })
      ),
      window.electronAPI.onWorkspaceMenuRemoveItem(onRemoveItem),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [
    itemsMap,
    handlePathOperation,
    setEditingItemId,
    onLaunch,
    onMoveItemToGroup,
    onRemoveItem,
    onEditItem,
  ]);

  React.useEffect(() => {
    const cleanups = [
      window.electronAPI.onWorkspaceGroupMenuRename(setEditingGroupId),
      window.electronAPI.onWorkspaceGroupMenuShowColorPicker(setColorPickerGroupId),
      window.electronAPI.onWorkspaceGroupMenuChangeColor((groupId, color) =>
        onUpdateGroup(groupId, { color })
      ),
      window.electronAPI.onWorkspaceGroupMenuCopyAsText((groupId) => {
        const group = groupsMap.get(groupId);
        if (group) {
          const groupItems = itemsByGroup[groupId] || [];
          let text = `【${group.displayName}】\r\n`;
          /* eslint-disable no-irregular-whitespace */
          groupItems.forEach((item, index) => {
            text += `　■${item.displayName}\r\n`;
            text += `　　${item.path}\r\n`;
            if (index < groupItems.length - 1) {
              text += '\r\n';
            }
          });
          /* eslint-enable no-irregular-whitespace */
          window.electronAPI.copyToClipboard(text);
        }
      }),
      window.electronAPI.onWorkspaceGroupMenuArchive(onArchiveGroup),
      window.electronAPI.onWorkspaceGroupMenuDelete(onDeleteGroup),
      window.electronAPI.onWorkspaceGroupMenuAddSubgroup((parentGroupId) => {
        const childCount = groups.filter((g) => g.parentGroupId === parentGroupId).length;
        onAddSubgroup(parentGroupId, childCount);
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [
    groupsMap,
    groups,
    itemsByGroup,
    onUpdateGroup,
    onArchiveGroup,
    onDeleteGroup,
    onAddSubgroup,
  ]);

  /** グループヘッダーの dragEnd でウィンドウ外ドロップを検出 */
  const handleGroupDragEndForDetach = (e: React.DragEvent, groupId: string) => {
    if (!onDetachGroup) return;
    // dropEffect === 'none' はどのドロップターゲットにも受け入れられなかったことを示す
    if (e.dataTransfer.dropEffect === 'none') {
      onDetachGroup(groupId, e.screenX, e.screenY);
    }
  };

  const handleMixedDragStart = (id: string, kind: 'item' | 'group') => (e: React.DragEvent) => {
    setDraggedElement({ id, kind });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('itemId', kind === 'item' ? id : '');
    e.dataTransfer.setData('groupId', kind === 'group' ? id : '');

    // ドラッグ元の現在の親グループIDを記録（グループ間移動判定に使用）
    if (kind === 'item') {
      e.dataTransfer.setData('currentGroupId', itemsMap.get(id)?.groupId || '');
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
      e.dataTransfer.dropEffect = 'move';
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
    if (dragKind === 'group') {
      return groupTree.map((node) => ({ id: node.group.id, kind: 'group' as const }));
    }
    return uncategorizedItems.map((item) => ({ id: item.id, kind: 'item' as const }));
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
          } else {
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

  const handleGroupDragOver = (groupId?: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const isNative = isNativeFileDrag(e);
    const isCopyOperation = e.dataTransfer.types.includes('launcheritem');

    if (isNative) {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = isCopyOperation ? 'copy' : 'move';
    }

    // ワークスペース内アイテム並び替え以外はハイライト表示
    if (isNative || isCopyOperation) {
      const id = groupId ?? '__uncategorized__';
      setDragOverGroupId(id);
      // dragoverは継続発火するため、タイマーでリセット
      if (dragOverTimerRef.current) {
        clearTimeout(dragOverTimerRef.current);
      }
      dragOverTimerRef.current = setTimeout(() => {
        setDragOverGroupId(null);
      }, 150);
    }
  };

  /** AppItem（LauncherItem/GroupItem/WindowItem/ClipboardItem）をワークスペースに追加 */
  async function addAppItemToWorkspace(appItemData: string, groupId?: string): Promise<void> {
    const item: AppItem = JSON.parse(appItemData);
    await window.electronAPI.workspaceAPI.addItem(item, groupId);
    // WindowInfoはドラッグ不可のため実際には来ないが、型安全のためinチェックを使用
    await window.electronAPI.showToastWindow({
      displayName: 'displayName' in item ? item.displayName : '',
      itemType: 'workspaceAdd',
      path: 'path' in item ? item.path : undefined,
      icon: 'icon' in item ? item.icon : undefined,
    });
  }

  const handleGroupDrop = (groupId?: string) => async (e: React.DragEvent) => {
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

    // dataTransferは未設定値を空文字列で返すため、groupId(undefined)と比較する際に正規化
    const normalizeGroupId = (id: string): string | undefined => id || undefined;

    try {
      if (launcherItemData) {
        // ランチャーからのアイテム追加
        await addAppItemToWorkspace(launcherItemData, groupId);
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
      logError('ワークスペースへのアイテム追加に失敗:', error);
      await window.electronAPI.showToastWindow({
        displayName: 'ワークスペース',
        itemType: 'workspaceAdd',
        message: 'ワークスペースへの追加に失敗しました',
      });
    }

    setDraggedElement(null);
  };

  const handleContextMenu = (item: WorkspaceItem) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.electronAPI.showWorkspaceContextMenu(item, groups);
  };

  const handleGroupContextMenu = (group: WorkspaceGroup) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const canAdd = canCreateSubgroup(group.id, groups);
    window.electronAPI.showWorkspaceGroupContextMenu(group, canAdd);
  };

  const handleGroupToggle = (groupId: string) => {
    onToggleGroup(groupId);
    setActiveGroupId(groupId);
  };

  const handleUncategorizedToggle = () => {
    onToggleUncategorized();
    setActiveGroupId(undefined);
  };

  /** 子ノードのマップ（renderGroupNode内でサブグループ再帰用） */
  const childNodeMap = React.useMemo(() => {
    const map = new Map<string, GroupTreeNode>();
    const buildMap = (nodes: GroupTreeNode[]) => {
      for (const node of nodes) {
        map.set(node.group.id, node);
        buildMap(node.children);
      }
    };
    buildMap(groupTree);
    return map;
  }, [groupTree]);

  /** 再帰的にグループツリーノードをレンダリング（混在表示対応） */
  const renderGroupNode = (node: GroupTreeNode): React.ReactNode => {
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
        onDragOver={handleGroupDragOver(node.group.id)}
        onDrop={handleGroupDrop(node.group.id)}
      >
        <WorkspaceGroupHeader
          group={node.group}
          itemCount={groupItems.length}
          isEditing={editingGroupId === node.group.id}
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
              return (
                <WorkspaceItemCard
                  key={child.item.id}
                  item={child.item}
                  isEditing={editingItemId === child.item.id}
                  draggedElement={draggedElement}
                  onLaunch={onLaunch}
                  onRemove={onRemoveItem}
                  onUpdateDisplayName={onUpdateDisplayName}
                  onStartEdit={() =>
                    setEditingItemId(editingItemId === child.item.id ? null : child.item.id)
                  }
                  onDragStart={handleMixedDragStart(child.item.id, 'item')}
                  onDragEnd={handleMixedDragEnd}
                  onDragOver={handleMixedDragOver}
                  onDrop={(e, zone) =>
                    handleMixedDrop(child.item.id, 'item', node.group.id, zone)(e)
                  }
                  onContextMenu={handleContextMenu(child.item)}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // アイテムが1つもない場合
  if (items.length === 0 && groups.length === 0) {
    return (
      <div className="workspace-empty">
        <p>ワークスペースは空です</p>
        <p className="workspace-empty-hint">
          メイン画面のアイテムを右クリックして
          <br />
          「ワークスペースに追加」を選択してください
        </p>
      </div>
    );
  }

  return (
    <div className="workspace-item-list">
      <div ref={contentRef}>
        {/* ツリー構造でグループをレンダリング */}
        {groupTree.map((node) => renderGroupNode(node))}

        {filteredUncategorizedItems.length > 0 && showUncategorized && (
          <div
            className={`workspace-uncategorized-section${dragOverGroupId === '__uncategorized__' ? ' drag-over' : ''}`}
            onDragOver={handleGroupDragOver(undefined)}
            onDrop={handleGroupDrop(undefined)}
          >
            <div
              className="workspace-group-header"
              onClick={handleUncategorizedToggle}
              style={{ '--group-color': 'var(--color-secondary)' } as React.CSSProperties}
            >
              <span
                className={`workspace-group-collapse-icon${uncategorizedCollapsed ? ' collapsed' : ''}`}
              >
                ▼
              </span>
              <span className="workspace-group-name">未分類</span>
              <span className="workspace-group-badge">{filteredUncategorizedItems.length}</span>
            </div>
            {!uncategorizedCollapsed && (
              <div className="workspace-group-items">
                {filteredUncategorizedItems.map((item) => (
                  <WorkspaceItemCard
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
                    onDrop={(e, zone) => handleMixedDrop(item.id, 'item', undefined, zone)(e)}
                    onContextMenu={handleContextMenu(item)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

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
      </div>
    </div>
  );
};

export default WorkspaceGroupedList;
