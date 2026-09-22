import type {
  WorkspaceItem,
  WorkspaceItemUpdate,
  WorkspaceGroupUpdate,
  MixedOrderEntry,
} from '@common/types';
import { toToastItemType } from '@common/utils/workspaceConverters';

import { logError } from '../../utils/debug';

function withErrorHandling<T extends unknown[]>(
  action: (...args: T) => Promise<unknown>,
  errorMessage: string,
  onSuccess?: () => void
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await action(...args);
      onSuccess?.();
    } catch (error) {
      logError(errorMessage, error);
    }
  };
}

export function useWorkspaceActions(onDataChanged: () => void) {
  const api = window.electronAPI.workspaceAPI;

  const handleLaunch = withErrorHandling(async (item: WorkspaceItem) => {
    await window.electronAPI.showToastWindow({
      displayName: item.displayName,
      itemType: toToastItemType(item),
      ...(item.type === 'group' && {
        itemCount: item.itemNames.length,
        itemNames: item.itemNames.slice(0, 3),
      }),
      ...(item.type === 'item' && {
        path: item.path,
        icon: item.icon,
      }),
    });
    await api.launchItem(item);
  }, 'Failed to launch workspace item:');

  const handleRemove = withErrorHandling(
    async (id: string) => api.removeItem(id),
    'Failed to remove workspace item:',
    onDataChanged
  );

  const handleUpdateDisplayName = withErrorHandling(
    async (id: string, displayName: string) => api.updateDisplayName(id, displayName),
    'Failed to update workspace item display name:',
    onDataChanged
  );

  const handleUpdateItem = withErrorHandling(
    async (id: string, updates: WorkspaceItemUpdate) => api.updateItem(id, updates),
    'Failed to update workspace item:',
    onDataChanged
  );

  const handleUpdateGroup = withErrorHandling(
    async (groupId: string, updates: WorkspaceGroupUpdate) => api.updateGroup(groupId, updates),
    'Failed to update workspace group:',
    onDataChanged
  );

  const handleDeleteGroup = withErrorHandling(
    async (groupId: string, deleteItems: boolean) => api.deleteGroup(groupId, deleteItems),
    'Failed to delete workspace group:',
    onDataChanged
  );

  const handleArchiveGroup = withErrorHandling(
    async (groupId: string) => api.archiveGroup(groupId),
    'Failed to archive workspace group:',
    onDataChanged
  );

  const handleAddGroup = withErrorHandling(
    async (groupCount: number, parentGroupId?: string, workspaceId?: string) =>
      api.createGroup(`グループ ${groupCount + 1}`, undefined, parentGroupId, workspaceId),
    'Failed to create workspace group:',
    onDataChanged
  );

  const handleCreateWorkspace = withErrorHandling(
    async (name: string) => api.createWorkspace(name),
    'Failed to create workspace:',
    onDataChanged
  );

  const handleRenameWorkspace = withErrorHandling(
    async (id: string, name: string) => api.renameWorkspace(id, name),
    'Failed to rename workspace:',
    onDataChanged
  );

  const handleDeleteWorkspace = withErrorHandling(
    async (id: string) => api.deleteWorkspace(id),
    'Failed to delete workspace:',
    onDataChanged
  );

  const handleReorderWorkspaces = withErrorHandling(
    async (ids: string[]) => api.reorderWorkspaces(ids),
    'Failed to reorder workspaces:',
    onDataChanged
  );

  const handleAddSubgroup = withErrorHandling(
    async (parentGroupId: string, subgroupCount: number) =>
      api.createGroup(`サブグループ ${subgroupCount + 1}`, undefined, parentGroupId),
    'Failed to create workspace subgroup:',
    onDataChanged
  );

  const handleDuplicateItem = withErrorHandling(
    async (sourceItemId: string, targetGroupId?: string, insertOrder?: number) =>
      api.duplicateItem(sourceItemId, targetGroupId, insertOrder),
    'Failed to duplicate workspace item:',
    onDataChanged
  );

  const handleMoveItemToGroup = withErrorHandling(
    async (itemId: string, groupId?: string) => api.moveItemToGroup(itemId, groupId),
    'Failed to move item to group:',
    onDataChanged
  );

  const handleMoveGroupToParent = withErrorHandling(
    async (groupId: string, newParentGroupId?: string) =>
      api.moveGroupToParent(groupId, newParentGroupId),
    'Failed to move group to parent:',
    onDataChanged
  );

  const handleReorderMixed = withErrorHandling(
    async (parentGroupId: string | undefined, entries: MixedOrderEntry[]) =>
      api.reorderMixed(parentGroupId, entries),
    'Failed to reorder mixed children:',
    onDataChanged
  );

  return {
    handleLaunch,
    handleRemove,
    handleUpdateDisplayName,
    handleUpdateItem,
    handleUpdateGroup,
    handleDeleteGroup,
    handleArchiveGroup,
    handleAddGroup,
    handleAddSubgroup,
    handleDuplicateItem,
    handleMoveItemToGroup,
    handleMoveGroupToParent,
    handleReorderMixed,
    handleCreateWorkspace,
    handleRenameWorkspace,
    handleDeleteWorkspace,
    handleReorderWorkspaces,
  };
}
