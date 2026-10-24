import { useMemo } from 'react';
import type { WorkspaceItem, WorkspaceGroupView, MixedChild } from '@common/types';
import { buildGroupTree, getMixedChildren, type GroupTreeNode } from '@common/utils/groupTreeUtils';

export function useWorkspaceItemGroups(items: WorkspaceItem[], groups?: WorkspaceGroupView[]) {
  const itemsByGroup = useMemo(() => {
    const result: Record<string, WorkspaceItem[]> = {};
    // どのアイテムもグループに入る（グループを持たないアイテムは読み込み時に「未分類」グループへ入る。A3-157）
    for (const item of items) {
      if (item.groupId) (result[item.groupId] ??= []).push(item);
    }
    return result;
  }, [items]);

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

  return { itemsByGroup, groupTree, mixedChildrenByGroup };
}
