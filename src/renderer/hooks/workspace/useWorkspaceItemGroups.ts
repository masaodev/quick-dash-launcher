import { useMemo } from 'react';
import type { WorkspaceItem, WorkspaceGroup } from '@common/types';
import { buildGroupTree, type GroupTreeNode } from '@common/utils/groupTreeUtils';

export function useWorkspaceItemGroups(items: WorkspaceItem[], groups?: WorkspaceGroup[]) {
  const itemsByGroup = useMemo(() => {
    const result: Record<string, WorkspaceItem[]> = {};
    for (const item of items) {
      const groupId = item.groupId || 'uncategorized';
      (result[groupId] ??= []).push(item);
    }
    return result;
  }, [items]);

  const uncategorizedItems = itemsByGroup['uncategorized'] || [];

  const groupTree: GroupTreeNode[] = useMemo(
    () => (groups ? buildGroupTree(groups) : []),
    [groups]
  );

  return { itemsByGroup, uncategorizedItems, groupTree };
}
