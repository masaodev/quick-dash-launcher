import { useMemo } from 'react';
import type { WorkspaceGroup, WorkspaceItem } from '@common/types';

export type FilterScope = 'all' | 'group' | 'item';

interface FilterResult {
  visibleGroupIds: Set<string> | null;
  itemVisibility: Map<string, boolean> | null;
  showUncategorized: boolean;
}

export function useWorkspaceFilter(
  groups: WorkspaceGroup[],
  items: WorkspaceItem[],
  filterText: string,
  filterScope: FilterScope
): FilterResult {
  return useMemo(() => {
    if (!filterText.trim()) {
      return { visibleGroupIds: null, itemVisibility: null, showUncategorized: true };
    }

    const lower = filterText.toLowerCase();
    const visibleGroupIds = new Set<string>();
    const itemVisibility = new Map<string, boolean>();
    let showUncategorized = false;

    const matchedGroupIds = new Set(
      groups.filter((g) => g.displayName.toLowerCase().includes(lower)).map((g) => g.id)
    );

    switch (filterScope) {
      case 'group':
        matchedGroupIds.forEach((id) => visibleGroupIds.add(id));
        for (const item of items) {
          itemVisibility.set(item.id, !!(item.groupId && matchedGroupIds.has(item.groupId)));
        }
        break;

      case 'item':
        for (const item of items) {
          const matches = item.displayName.toLowerCase().includes(lower);
          itemVisibility.set(item.id, matches);
          if (matches) {
            if (item.groupId) {
              visibleGroupIds.add(item.groupId);
            } else {
              showUncategorized = true;
            }
          }
        }
        break;

      case 'all':
      default:
        for (const item of items) {
          const itemMatches = item.displayName.toLowerCase().includes(lower);
          const groupMatches = !!(item.groupId && matchedGroupIds.has(item.groupId));

          if (itemMatches || groupMatches) {
            itemVisibility.set(item.id, true);
            if (item.groupId) {
              visibleGroupIds.add(item.groupId);
            } else if (itemMatches) {
              showUncategorized = true;
            }
          } else {
            itemVisibility.set(item.id, false);
          }
        }
        matchedGroupIds.forEach((id) => visibleGroupIds.add(id));
        break;
    }

    return {
      visibleGroupIds: visibleGroupIds.size > 0 ? visibleGroupIds : null,
      itemVisibility,
      showUncategorized,
    };
  }, [groups, items, filterText, filterScope]);
}
