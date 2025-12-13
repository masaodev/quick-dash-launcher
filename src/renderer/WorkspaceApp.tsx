import React, { useState, useEffect } from 'react';
import type { WorkspaceItem, WorkspaceGroup } from '@common/types';

import WorkspaceGroupedList from './components/WorkspaceGroupedList';

const WorkspaceApp: React.FC = () => {
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [groups, setGroups] = useState<WorkspaceGroup[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    loadItems();
    loadGroups();

    // ワークスペース変更イベントをリッスン
    const unsubscribe = window.electronAPI.onWorkspaceChanged(() => {
      loadItems();
      loadGroups();
    });

    // ネイティブのドラッグ&ドロップイベントを設定
    const handleNativeDragOver = (e: DragEvent) => {
      // ファイルがドラッグされている場合のみ反応
      if (e.dataTransfer?.types && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
      }
    };

    const handleNativeDragLeave = (e: DragEvent) => {
      // ファイルがドラッグされている場合のみ反応
      if (e.dataTransfer?.types && e.dataTransfer.types.includes('Files')) {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
      }
    };

    const handleNativeDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      console.log('[DEBUG] Native drop event triggered');

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const filePaths: string[] = [];

        // メイン画面と同じ方法でファイルパスを取得
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          try {
            const filePath = window.electronAPI.getPathForFile(file);
            console.log('[DEBUG] File:', file.name, 'Path:', filePath);
            if (filePath) {
              filePaths.push(filePath);
            }
          } catch (error) {
            console.error(`Error getting path for ${file.name}:`, error);
          }
        }

        console.log('[DEBUG] All file paths:', filePaths);

        if (filePaths.length > 0) {
          try {
            console.log('[DEBUG] Calling addItemsFromPaths');
            const result = await window.electronAPI.workspaceAPI.addItemsFromPaths(filePaths);
            console.log('[DEBUG] Result:', result);
            await loadItems();
            console.log(`Added ${filePaths.length} items from drag & drop`);
          } catch (error) {
            console.error('Failed to add items from drag & drop:', error);
          }
        } else {
          console.log('[DEBUG] No file paths found - files may not be from local filesystem');
        }
      }
    };

    // ネイティブイベントリスナーを追加
    document.addEventListener('dragover', handleNativeDragOver);
    document.addEventListener('dragleave', handleNativeDragLeave);
    document.addEventListener('drop', handleNativeDrop);

    return () => {
      unsubscribe();
      document.removeEventListener('dragover', handleNativeDragOver);
      document.removeEventListener('dragleave', handleNativeDragLeave);
      document.removeEventListener('drop', handleNativeDrop);
    };
  }, []);

  const loadItems = async () => {
    try {
      const loadedItems = await window.electronAPI.workspaceAPI.loadItems();
      setItems(loadedItems);
    } catch (error) {
      console.error('Failed to load workspace items:', error);
    }
  };

  const loadGroups = async () => {
    try {
      const loadedGroups = await window.electronAPI.workspaceAPI.loadGroups();
      setGroups(loadedGroups);
    } catch (error) {
      console.error('Failed to load workspace groups:', error);
    }
  };

  const handleLaunch = async (item: WorkspaceItem) => {
    try {
      await window.electronAPI.workspaceAPI.launchItem(item);
    } catch (error) {
      console.error('Failed to launch workspace item:', error);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await window.electronAPI.workspaceAPI.removeItem(id);
      await loadItems();
    } catch (error) {
      console.error('Failed to remove workspace item:', error);
    }
  };

  const handleReorder = async (itemIds: string[]) => {
    try {
      await window.electronAPI.workspaceAPI.reorderItems(itemIds);
      await loadItems();
    } catch (error) {
      console.error('Failed to reorder workspace items:', error);
    }
  };

  const handleUpdateDisplayName = async (id: string, displayName: string) => {
    try {
      await window.electronAPI.workspaceAPI.updateDisplayName(id, displayName);
      await loadItems();
      setEditingId(null);
    } catch (error) {
      console.error('Failed to update workspace item display name:', error);
    }
  };

  // グループ関連ハンドラー
  const handleToggleGroup = async (groupId: string) => {
    try {
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        await window.electronAPI.workspaceAPI.updateGroup(groupId, {
          collapsed: !group.collapsed,
        });
        await loadGroups();
      }
    } catch (error) {
      console.error('Failed to toggle workspace group:', error);
    }
  };

  const handleUpdateGroup = async (groupId: string, updates: Partial<WorkspaceGroup>) => {
    try {
      await window.electronAPI.workspaceAPI.updateGroup(groupId, updates);
      await loadGroups();
    } catch (error) {
      console.error('Failed to update workspace group:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      // グループ内のアイテム数を確認
      const groupItems = items.filter((item) => item.groupId === groupId);
      const hasItems = groupItems.length > 0;

      let deleteItems = false;

      if (hasItems) {
        // 確認ダイアログを表示
        const message =
          `このグループには${groupItems.length}個のアイテムが含まれています。\n\n` +
          `OKを押すと、アイテムは未分類に移動します。\n` +
          `キャンセルを押すと、グループとアイテムの両方が削除されます。`;

        const moveToUncategorized = window.confirm(message);
        deleteItems = !moveToUncategorized;
      }

      await window.electronAPI.workspaceAPI.deleteGroup(groupId, deleteItems);
      await loadGroups();
      await loadItems();
    } catch (error) {
      console.error('Failed to delete workspace group:', error);
    }
  };

  const handleAddGroup = async () => {
    try {
      const groupNumber = groups.length + 1;
      await window.electronAPI.workspaceAPI.createGroup(`グループ ${groupNumber}`);
      await loadGroups();
    } catch (error) {
      console.error('Failed to create workspace group:', error);
    }
  };

  const handleMoveItemToGroup = async (itemId: string, groupId?: string) => {
    try {
      await window.electronAPI.workspaceAPI.moveItemToGroup(itemId, groupId);
      await loadItems();
    } catch (error) {
      console.error('Failed to move item to group:', error);
    }
  };

  const handleReorderGroups = async (groupIds: string[]) => {
    try {
      await window.electronAPI.workspaceAPI.reorderGroups(groupIds);
      await loadGroups();
    } catch (error) {
      console.error('Failed to reorder workspace groups:', error);
    }
  };

  return (
    <div className={`workspace-window ${isDraggingOver ? 'dragging-over' : ''}`}>
      <div className="workspace-header">
        <h1>Workspace</h1>
      </div>
      <WorkspaceGroupedList
        groups={groups}
        items={items}
        onLaunch={handleLaunch}
        onRemoveItem={handleRemove}
        onReorderItems={handleReorder}
        onUpdateDisplayName={handleUpdateDisplayName}
        onToggleGroup={handleToggleGroup}
        onUpdateGroup={handleUpdateGroup}
        onDeleteGroup={handleDeleteGroup}
        onAddGroup={handleAddGroup}
        onMoveItemToGroup={handleMoveItemToGroup}
        onReorderGroups={handleReorderGroups}
        editingItemId={editingId}
        setEditingItemId={setEditingId}
      />
    </div>
  );
};

export default WorkspaceApp;
