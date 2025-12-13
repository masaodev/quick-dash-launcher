import React, { useState } from 'react';
import type { WorkspaceItem } from '@common/types';

import WorkspaceItemCard from './WorkspaceItemCard';

interface WorkspaceItemListProps {
  items: WorkspaceItem[];
  onLaunch: (item: WorkspaceItem) => void;
  onRemove: (id: string) => void;
  onReorder: (itemIds: string[]) => void;
  onUpdateDisplayName: (id: string, displayName: string) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
}

const WorkspaceItemList: React.FC<WorkspaceItemListProps> = ({
  items,
  onLaunch,
  onRemove,
  onReorder,
  onUpdateDisplayName,
  editingId,
  setEditingId,
}) => {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [_dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  const handleDragStart = (item: WorkspaceItem) => (e: React.DragEvent) => {
    setDraggedItemId(item.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (item: WorkspaceItem) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItemId(item.id);
  };

  const handleDrop = (item: WorkspaceItem) => (e: React.DragEvent) => {
    e.preventDefault();

    if (!draggedItemId || draggedItemId === item.id) {
      setDraggedItemId(null);
      setDragOverItemId(null);
      return;
    }

    // アイテムの並び替え
    const draggedIndex = items.findIndex((i) => i.id === draggedItemId);
    const targetIndex = items.findIndex((i) => i.id === item.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItemId(null);
      setDragOverItemId(null);
      return;
    }

    const newItems = [...items];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, draggedItem);

    // 新しい順序でIDリストを作成
    const newItemIds = newItems.map((i) => i.id);
    onReorder(newItemIds);

    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  const _handleDragEnd = () => {
    setDraggedItemId(null);
    setDragOverItemId(null);
  };

  if (items.length === 0) {
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
      {items.map((item) => (
        <WorkspaceItemCard
          key={item.id}
          item={item}
          isEditing={editingId === item.id}
          onLaunch={onLaunch}
          onRemove={onRemove}
          onUpdateDisplayName={onUpdateDisplayName}
          onStartEdit={() => setEditingId(editingId === item.id ? null : item.id)}
          onDragStart={handleDragStart(item)}
          onDragOver={handleDragOver(item)}
          onDrop={handleDrop(item)}
        />
      ))}
    </div>
  );
};

export default WorkspaceItemList;
