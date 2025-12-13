import React from 'react';
import type { WorkspaceItem, WorkspaceGroup } from '@common/types';

import WorkspaceGroupHeader from './WorkspaceGroupHeader';
import WorkspaceItemCard from './WorkspaceItemCard';
import WorkspaceContextMenu from './WorkspaceContextMenu';

interface WorkspaceGroupedListProps {
  groups: WorkspaceGroup[];
  items: WorkspaceItem[];
  onLaunch: (item: WorkspaceItem) => void;
  onRemoveItem: (id: string) => void;
  onReorderItems: (itemIds: string[]) => void;
  onUpdateDisplayName: (id: string, displayName: string) => void;
  onToggleGroup: (groupId: string) => void;
  onUpdateGroup: (groupId: string, updates: Partial<WorkspaceGroup>) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddGroup: () => void;
  onMoveItemToGroup: (itemId: string, groupId?: string) => void;
  onReorderGroups: (groupIds: string[]) => void;
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
}

const WorkspaceGroupedList: React.FC<WorkspaceGroupedListProps> = ({
  groups,
  items,
  onLaunch,
  onRemoveItem,
  onReorderItems,
  onUpdateDisplayName,
  onToggleGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAddGroup,
  onMoveItemToGroup,
  onReorderGroups,
  editingItemId,
  setEditingItemId,
}) => {
  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
  const [draggedGroupId, setDraggedGroupId] = React.useState<string | null>(null);
  const [contextMenu, setContextMenu] = React.useState<{
    isVisible: boolean;
    position: { x: number; y: number };
    item: WorkspaceItem | null;
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    item: null,
  });

  // グループIDごとにアイテムを分類
  const itemsByGroup = items.reduce(
    (acc, item) => {
      const groupId = item.groupId || 'uncategorized';
      if (!acc[groupId]) {
        acc[groupId] = [];
      }
      acc[groupId].push(item);
      return acc;
    },
    {} as Record<string, WorkspaceItem[]>
  );

  // 未分類のアイテム
  const uncategorizedItems = itemsByGroup['uncategorized'] || [];

  // ドラッグ&ドロップハンドラー
  const handleItemDragStart = (item: WorkspaceItem) => (e: React.DragEvent) => {
    setDraggedItemId(item.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('itemId', item.id);
    e.dataTransfer.setData('currentGroupId', item.groupId || '');
  };

  const handleItemDragEnd = () => {
    setDraggedItemId(null);
  };

  const handleGroupDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleGroupDrop = (groupId?: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    const currentGroupId = e.dataTransfer.getData('currentGroupId');

    if (itemId && currentGroupId !== (groupId || '')) {
      onMoveItemToGroup(itemId, groupId);
    }
    setDraggedItemId(null);
  };

  // グループの並び替えハンドラー
  const handleGroupDragStart = (group: WorkspaceGroup) => (e: React.DragEvent) => {
    setDraggedGroupId(group.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('groupId', group.id);
  };

  const handleGroupDragEnd = () => {
    setDraggedGroupId(null);
  };

  const handleGroupDragOverForReorder = (group: WorkspaceGroup) => (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('groupId');
    if (draggedId) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleGroupDropForReorder = (targetGroup: WorkspaceGroup) => (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('groupId');

    if (draggedId && draggedId !== targetGroup.id) {
      // 新しい順序を計算
      const draggedIndex = groups.findIndex((g) => g.id === draggedId);
      const targetIndex = groups.findIndex((g) => g.id === targetGroup.id);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newGroups = [...groups];
        const [draggedGroup] = newGroups.splice(draggedIndex, 1);
        newGroups.splice(targetIndex, 0, draggedGroup);

        // 新しい順序でIDリストを作成
        const newGroupIds = newGroups.map((g) => g.id);
        onReorderGroups(newGroupIds);
      }
    }
    setDraggedGroupId(null);
  };

  // コンテキストメニューハンドラー
  const handleContextMenu = (item: WorkspaceItem) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isVisible: true,
      position: { x: e.clientX, y: e.clientY },
      item,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({
      isVisible: false,
      position: { x: 0, y: 0 },
      item: null,
    });
  };

  const handleEditFromContextMenu = (item: WorkspaceItem) => {
    setEditingItemId(item.id);
  };

  const handleRemoveFromGroup = (item: WorkspaceItem) => {
    if (item.groupId) {
      onMoveItemToGroup(item.id, undefined);
    }
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
      {/* グループを表示 */}
      {groups.map((group) => {
        const groupItems = itemsByGroup[group.id] || [];
        return (
          <div key={group.id} className="workspace-group">
            <WorkspaceGroupHeader
              group={group}
              itemCount={groupItems.length}
              onToggle={onToggleGroup}
              onUpdate={onUpdateGroup}
              onDelete={onDeleteGroup}
              onDragOver={handleGroupDragOver}
              onDrop={handleGroupDrop(group.id)}
              onGroupDragStart={handleGroupDragStart(group)}
              onGroupDragEnd={handleGroupDragEnd}
              onGroupDragOverForReorder={handleGroupDragOverForReorder(group)}
              onGroupDropForReorder={handleGroupDropForReorder(group)}
            />
            {!group.collapsed && (
              <div className="workspace-group-items">
                {groupItems.map((item) => (
                  <WorkspaceItemCard
                    key={item.id}
                    item={item}
                    isEditing={editingItemId === item.id}
                    onLaunch={onLaunch}
                    onRemove={onRemoveItem}
                    onUpdateDisplayName={onUpdateDisplayName}
                    onStartEdit={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                    onDragStart={handleItemDragStart(item)}
                    onDragEnd={handleItemDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => e.preventDefault()}
                    onContextMenu={handleContextMenu(item)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* 未分類セクション */}
      {uncategorizedItems.length > 0 && (
        <div
          className="workspace-uncategorized-section"
          onDragOver={handleGroupDragOver}
          onDrop={handleGroupDrop(undefined)}
        >
          <div className="workspace-uncategorized-header">未分類</div>
          <div className="workspace-group-items">
            {uncategorizedItems.map((item) => (
              <WorkspaceItemCard
                key={item.id}
                item={item}
                isEditing={editingItemId === item.id}
                onLaunch={onLaunch}
                onRemove={onRemoveItem}
                onUpdateDisplayName={onUpdateDisplayName}
                onStartEdit={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                onDragStart={handleItemDragStart(item)}
                onDragEnd={handleItemDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                onContextMenu={handleContextMenu(item)}
              />
            ))}
          </div>
        </div>
      )}

      {/* グループ追加ボタン */}
      <button className="workspace-add-group-btn" onClick={onAddGroup}>
        + グループを追加
      </button>

      {/* コンテキストメニュー */}
      <WorkspaceContextMenu
        isVisible={contextMenu.isVisible}
        position={contextMenu.position}
        item={contextMenu.item}
        onClose={handleCloseContextMenu}
        onEdit={handleEditFromContextMenu}
        onLaunch={onLaunch}
        onRemove={onRemoveItem}
        onRemoveFromGroup={handleRemoveFromGroup}
      />
    </div>
  );
};

export default WorkspaceGroupedList;
