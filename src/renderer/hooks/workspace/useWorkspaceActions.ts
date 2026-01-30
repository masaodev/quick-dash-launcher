import type { WorkspaceItem, WorkspaceGroup } from '@common/types';

import { logError } from '../../utils/debug';

/**
 * ワークスペースの操作（起動、削除、並び替え、更新等）を統合管理するフック
 */
export function useWorkspaceActions(onDataChanged: () => void) {
  const handleLaunch = async (item: WorkspaceItem) => {
    try {
      await window.electronAPI.workspaceAPI.launchItem(item);
    } catch (error) {
      logError('Failed to launch workspace item:', error);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await window.electronAPI.workspaceAPI.removeItem(id);
      onDataChanged();
    } catch (error) {
      logError('Failed to remove workspace item:', error);
    }
  };

  const handleReorder = async (itemIds: string[]) => {
    try {
      await window.electronAPI.workspaceAPI.reorderItems(itemIds);
      onDataChanged();
    } catch (error) {
      logError('Failed to reorder workspace items:', error);
    }
  };

  const handleUpdateDisplayName = async (id: string, displayName: string) => {
    try {
      await window.electronAPI.workspaceAPI.updateDisplayName(id, displayName);
      onDataChanged();
    } catch (error) {
      logError('Failed to update workspace item display name:', error);
    }
  };

  const handleUpdateItem = async (id: string, updates: Partial<WorkspaceItem>) => {
    try {
      await window.electronAPI.workspaceAPI.updateItem(id, updates);
      onDataChanged();
    } catch (error) {
      logError('Failed to update workspace item:', error);
    }
  };

  const handleToggleGroup = async (groupId: string, groups: WorkspaceGroup[]) => {
    try {
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        await window.electronAPI.workspaceAPI.updateGroup(groupId, {
          collapsed: !group.collapsed,
        });
        onDataChanged();
      }
    } catch (error) {
      logError('Failed to toggle workspace group:', error);
    }
  };

  const handleUpdateGroup = async (groupId: string, updates: Partial<WorkspaceGroup>) => {
    try {
      await window.electronAPI.workspaceAPI.updateGroup(groupId, updates);
      onDataChanged();
    } catch (error) {
      logError('Failed to update workspace group:', error);
    }
  };

  const handleDeleteGroup = async (groupId: string, deleteItems: boolean) => {
    try {
      await window.electronAPI.workspaceAPI.deleteGroup(groupId, deleteItems);
      onDataChanged();
    } catch (error) {
      logError('Failed to delete workspace group:', error);
    }
  };

  const handleArchiveGroup = async (groupId: string) => {
    try {
      await window.electronAPI.workspaceAPI.archiveGroup(groupId);
      onDataChanged();
    } catch (error) {
      logError('Failed to archive workspace group:', error);
    }
  };

  const handleAddGroup = async (groupCount: number) => {
    try {
      await window.electronAPI.workspaceAPI.createGroup(`グループ ${groupCount + 1}`);
      onDataChanged();
    } catch (error) {
      logError('Failed to create workspace group:', error);
    }
  };

  const handleMoveItemToGroup = async (itemId: string, groupId?: string) => {
    try {
      await window.electronAPI.workspaceAPI.moveItemToGroup(itemId, groupId);
      onDataChanged();
    } catch (error) {
      logError('Failed to move item to group:', error);
    }
  };

  const handleReorderGroups = async (groupIds: string[]) => {
    try {
      await window.electronAPI.workspaceAPI.reorderGroups(groupIds);
      onDataChanged();
    } catch (error) {
      logError('Failed to reorder workspace groups:', error);
    }
  };

  return {
    handleLaunch,
    handleRemove,
    handleReorder,
    handleUpdateDisplayName,
    handleUpdateItem,
    handleToggleGroup,
    handleUpdateGroup,
    handleDeleteGroup,
    handleArchiveGroup,
    handleAddGroup,
    handleMoveItemToGroup,
    handleReorderGroups,
  };
}
