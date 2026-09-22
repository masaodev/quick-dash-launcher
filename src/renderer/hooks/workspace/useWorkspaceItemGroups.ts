import { useMemo } from 'react';
import type { WorkspaceItem, WorkspaceGroupView, MixedChild } from '@common/types';
import { buildGroupTree, getMixedChildren, type GroupTreeNode } from '@common/utils/groupTreeUtils';

export function useWorkspaceItemGroups(items: WorkspaceItem[], groups?: WorkspaceGroupView[]) {
  const itemsByGroup = useMemo(() => {
    const result: Record<string, WorkspaceItem[]> = {};
    for (const item of items) {
      const groupId = item.groupId || 'uncategorized';
      (result[groupId] ??= []).push(item);
    }
    return result;
  }, [items]);

  const uncategorizedItems = itemsByGroup['uncategorized'] || [];

  const groupTree: GroupTreeNode<WorkspaceGroupView>[] = useMemo(
    () => (groups ? buildGroupTree(groups) : []),
    [groups]
  );

  const mixedChildrenByGroup: Record<string, MixedChild<WorkspaceGroupView>[]> = useMemo(() => {
    if (!groups) return {};
    const result: Record<string, MixedChild<WorkspaceGroupView>[]> = {};
    for (const group of groups) {
      const groupItems = itemsByGroup[group.id] || [];
      result[group.id] = getMixedChildren(group.id, groups, groupItems);
    }
    return result;
  }, [groups, itemsByGroup]);

  return { itemsByGroup, uncategorizedItems, groupTree, mixedChildrenByGroup };
}
