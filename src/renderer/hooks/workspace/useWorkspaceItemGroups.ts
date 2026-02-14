import { useMemo } from 'react';
import type { WorkspaceItem } from '@common/types';

export function useWorkspaceItemGroups(items: WorkspaceItem[]) {
  const itemsByGroup = useMemo(() => {
    return items.reduce(
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
  }, [items]);

  const uncategorizedItems = itemsByGroup['uncategorized'] || [];

  return { itemsByGroup, uncategorizedItems };
}
