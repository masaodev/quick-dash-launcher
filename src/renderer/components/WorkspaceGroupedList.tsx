import React from 'react';
import { PathUtils } from '@common/utils/pathUtils';
import type { WorkspaceItem, WorkspaceGroup, ExecutionHistoryItem } from '@common/types';

import WorkspaceGroupHeader from './WorkspaceGroupHeader';
import WorkspaceItemCard from './WorkspaceItemCard';
import ExecutionHistoryItemCard from './ExecutionHistoryItemCard';
import WorkspaceContextMenu from './WorkspaceContextMenu';

interface WorkspaceGroupedListProps {
  groups: WorkspaceGroup[];
  items: WorkspaceItem[];
  executionHistory: ExecutionHistoryItem[];
  onLaunch: (item: WorkspaceItem) => void;
  onRemoveItem: (id: string) => void;
  onReorderItems: (itemIds: string[]) => void;
  onUpdateDisplayName: (id: string, displayName: string) => void;
  onToggleGroup: (groupId: string) => void;
  onUpdateGroup: (groupId: string, updates: Partial<WorkspaceGroup>) => void;
  onDeleteGroup: (groupId: string) => void;
  onMoveItemToGroup: (itemId: string, groupId?: string) => void;
  onReorderGroups: (groupIds: string[]) => void;
  editingItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  uncategorizedCollapsed: boolean;
  onToggleUncategorized: () => void;
  historyCollapsed: boolean;
  onToggleHistory: () => void;
}

const WorkspaceGroupedList: React.FC<WorkspaceGroupedListProps> = ({
  groups,
  items,
  executionHistory,
  onLaunch,
  onRemoveItem,
  onReorderItems,
  onUpdateDisplayName,
  onToggleGroup,
  onUpdateGroup,
  onDeleteGroup,
  onMoveItemToGroup,
  onReorderGroups,
  editingItemId,
  setEditingItemId,
  uncategorizedCollapsed,
  onToggleUncategorized,
  historyCollapsed,
  onToggleHistory,
}) => {
  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
  const [_draggedGroupId, setDraggedGroupId] = React.useState<string | null>(null);
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

  const handleItemDragOver = (_item: WorkspaceItem) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItemId) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleItemDrop = (targetItem: WorkspaceItem) => (e: React.DragEvent) => {
    e.preventDefault();

    if (!draggedItemId || draggedItemId === targetItem.id) {
      setDraggedItemId(null);
      return;
    }

    // ドラッグ元のアイテムを取得
    const draggedItem = items.find((i) => i.id === draggedItemId);
    if (!draggedItem) {
      setDraggedItemId(null);
      return;
    }

    // 同じグループ内でのみ並び替えを許可
    const draggedGroupId = draggedItem.groupId || 'uncategorized';
    const targetGroupId = targetItem.groupId || 'uncategorized';

    if (draggedGroupId !== targetGroupId) {
      // 異なるグループ間の並び替えは禁止（グループ移動として扱う）
      setDraggedItemId(null);
      return;
    }

    // アイテムの並び替え
    const draggedIndex = items.findIndex((i) => i.id === draggedItemId);
    const targetIndex = items.findIndex((i) => i.id === targetItem.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItemId(null);
      return;
    }

    const newItems = [...items];
    const [movedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, movedItem);

    // 新しい順序でIDリストを作成
    const newItemIds = newItems.map((i) => i.id);
    onReorderItems(newItemIds);

    setDraggedItemId(null);
  };

  const handleGroupDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleGroupDrop = (groupId?: string) => async (e: React.DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('itemId');
    const currentGroupId = e.dataTransfer.getData('currentGroupId');
    const historyItemData = e.dataTransfer.getData('historyItem');

    // 実行履歴アイテムからのドロップの場合
    if (historyItemData) {
      try {
        const historyItem = JSON.parse(historyItemData);
        // ワークスペースにアイテムを追加
        const addedItem = await window.electronAPI.workspaceAPI.addItem(historyItem);
        // グループに移動
        if (groupId) {
          await window.electronAPI.workspaceAPI.moveItemToGroup(addedItem.id, groupId);
        }
      } catch (error) {
        console.error('実行履歴からのアイテム追加に失敗:', error);
      }
    }
    // 既存のワークスペースアイテムの移動
    else if (itemId && currentGroupId !== (groupId || '')) {
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

  const handleGroupDragOverForReorder = (_group: WorkspaceGroup) => (e: React.DragEvent) => {
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

  // パス操作ハンドラー
  const handleCopyPath = (item: WorkspaceItem) => {
    window.electronAPI.copyToClipboard(item.path);
  };

  const handleCopyParentPath = (item: WorkspaceItem) => {
    const parentPath = PathUtils.getParentPath(item.path);
    window.electronAPI.copyToClipboard(parentPath);
  };

  const handleOpenParentFolder = async (item: WorkspaceItem) => {
    const parentPath = PathUtils.getParentPath(item.path);
    await window.electronAPI.openExternalUrl(`file:///${parentPath}`);
  };

  const handleCopyShortcutPath = (item: WorkspaceItem) => {
    if (item.originalPath) {
      window.electronAPI.copyToClipboard(item.originalPath);
    }
  };

  const handleCopyShortcutParentPath = (item: WorkspaceItem) => {
    if (item.originalPath) {
      const parentPath = PathUtils.getParentPath(item.originalPath);
      window.electronAPI.copyToClipboard(parentPath);
    }
  };

  const handleOpenShortcutParentFolder = async (item: WorkspaceItem) => {
    if (item.originalPath) {
      const parentPath = PathUtils.getParentPath(item.originalPath);
      await window.electronAPI.openExternalUrl(`file:///${parentPath}`);
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
                    onDragOver={handleItemDragOver(item)}
                    onDrop={handleItemDrop(item)}
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
          <div
            className="workspace-uncategorized-header"
            onClick={onToggleUncategorized}
            style={{ cursor: 'pointer' }}
          >
            <span className="workspace-collapse-icon">{uncategorizedCollapsed ? '▶' : '▼'}</span>
            未分類 ({uncategorizedItems.length})
          </div>
          {!uncategorizedCollapsed && (
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
                  onDragOver={handleItemDragOver(item)}
                  onDrop={handleItemDrop(item)}
                  onContextMenu={handleContextMenu(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 実行履歴セクション */}
      {executionHistory.length > 0 && (
        <div className="workspace-execution-history-section">
          <div
            className="workspace-uncategorized-header"
            onClick={onToggleHistory}
            style={{ cursor: 'pointer' }}
          >
            <span className="workspace-collapse-icon">{historyCollapsed ? '▶' : '▼'}</span>
            実行履歴 ({executionHistory.length})
          </div>
          {!historyCollapsed && (
            <div className="workspace-group-items">
              {executionHistory.map((historyItem) => (
                <ExecutionHistoryItemCard
                  key={historyItem.id}
                  item={historyItem}
                  onLaunch={(item) => {
                    // 実行履歴アイテムを外部で起動
                    if (item.itemType === 'url' || item.itemType === 'customUri') {
                      window.electronAPI.openExternalUrl(item.itemPath);
                    } else if (
                      item.itemType === 'file' ||
                      item.itemType === 'folder' ||
                      item.itemType === 'app'
                    ) {
                      // LauncherItem形式に変換して起動
                      window.electronAPI.openItem({
                        name: item.itemName,
                        path: item.itemPath,
                        type: item.itemType,
                        icon: item.icon,
                      });
                    } else if (item.itemType === 'group') {
                      // グループは再実行しない（履歴としてのみ表示）
                    }
                  }}
                  onDragStart={(e) => {
                    // 実行履歴アイテムをワークスペースにコピーできるようにする
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('historyItemId', historyItem.id);
                    e.dataTransfer.setData(
                      'historyItem',
                      JSON.stringify({
                        name: historyItem.itemName,
                        path: historyItem.itemPath,
                        type: historyItem.itemType,
                        icon: historyItem.icon,
                      })
                    );
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
        onCopyPath={handleCopyPath}
        onCopyParentPath={handleCopyParentPath}
        onOpenParentFolder={handleOpenParentFolder}
        onCopyShortcutPath={handleCopyShortcutPath}
        onCopyShortcutParentPath={handleCopyShortcutParentPath}
        onOpenShortcutParentFolder={handleOpenShortcutParentFolder}
      />
    </div>
  );
};

export default WorkspaceGroupedList;
