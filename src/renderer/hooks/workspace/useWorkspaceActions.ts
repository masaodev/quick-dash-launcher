import type { WorkspaceItem, WorkspaceGroup, MixedOrderEntry } from '@common/types';

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
    const isGroup = item.type === 'group';
    const hasPathInfo =
      item.type !== 'group' && item.type !== 'clipboard' && item.type !== 'windowOperation';
    await window.electronAPI.showToastWindow({
      displayName: item.displayName,
      itemType: item.type,
      ...(isGroup && {
        itemCount: item.itemNames?.length ?? 0,
        itemNames: item.itemNames?.slice(0, 3),
      }),
      ...(hasPathInfo && {
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
    async (id: string, updates: Partial<WorkspaceItem>) => api.updateItem(id, updates),
    'Failed to update workspace item:',
    onDataChanged
  );

  const handleUpdateGroup = withErrorHandling(
    async (groupId: string, updates: Partial<WorkspaceGroup>) => api.updateGroup(groupId, updates),
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
    async (groupCount: number, parentGroupId?: string) =>
      api.createGroup(`グループ ${groupCount + 1}`, undefined, parentGroupId),
    'Failed to create workspace group:',
    onDataChanged
  );

  const handleAddSubgroup = withErrorHandling(
    async (parentGroupId: string, subgroupCount: number) =>
      api.createGroup(`サブグループ ${subgroupCount + 1}`, undefined, parentGroupId),
    'Failed to create workspace subgroup:',
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
    handleMoveItemToGroup,
    handleMoveGroupToParent,
    handleReorderMixed,
  };
}
