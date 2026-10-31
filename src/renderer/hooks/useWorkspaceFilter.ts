import { useMemo } from 'react';
import type { WorkspaceGroup, WorkspaceItem } from '@common/types';
import { getAncestorGroupIds, getDescendantGroupIds } from '@common/utils/groupTreeUtils';

import { normalizeForSearch, parseKeywords } from '../utils/dataParser';

export type FilterScope = 'all' | 'group' | 'item';

interface FilterResult {
  visibleGroupIds: Set<string> | null;
  itemVisibility: Map<string, boolean> | null;
}

/** 文がすべての語を含むか（メインウィンドウの検索と同じく、スペース区切りの AND） */
function includesAll(text: string, keywords: readonly string[]): boolean {
  const lower = normalizeForSearch(text);
  return keywords.every((keyword) => lower.includes(keyword));
}

/** アイテムの名前の文（参照はメインウィンドウの表示名も足す） */
function itemNameText(item: WorkspaceItem): string {
  return item.ref?.mainDisplayName
    ? `${item.displayName}\n${item.ref.mainDisplayName}`
    : item.displayName;
}

export function useWorkspaceFilter(
  groups: WorkspaceGroup[],
  items: WorkspaceItem[],
  filterText: string,
  filterScope: FilterScope,
  /** 検索で区別しない違いの設定（parseKeywords・normalizeForSearch が読む）。変わったら絞り直すためだけに受け取る */
  searchNormalization = ''
): FilterResult {
  return useMemo(() => {
    if (!filterText.trim()) {
      return { visibleGroupIds: null, itemVisibility: null };
    }

    const keywords = parseKeywords(filterText);
    const groupNameById = new Map(groups.map((g) => [g.id, g.displayName]));
    /** アイテムが入っているグループと、その親のグループの名前（「すべて」で語をグループ名とアイテム名にまたがって当てる） */
    const groupPathText = (groupId: string | undefined): string =>
      groupId
        ? [groupId, ...getAncestorGroupIds(groupId, groups)]
            .map((id) => groupNameById.get(id) ?? '')
            .join('\n')
        : '';
    const visibleGroupIds = new Set<string>();
    const itemVisibility = new Map<string, boolean>();

    /** グループIDとその全祖先をvisibleGroupIdsに追加 */
    function addGroupWithAncestors(groupId: string): void {
      visibleGroupIds.add(groupId);
      for (const ancestorId of getAncestorGroupIds(groupId, groups)) {
        visibleGroupIds.add(ancestorId);
      }
    }

    const matchedGroupIds = new Set(
      groups.filter((g) => includesAll(g.displayName, keywords)).map((g) => g.id)
    );

    // グループがマッチした場合、その子孫と祖先も表示対象にする
    const expandedGroupIds = new Set(matchedGroupIds);
    for (const gid of matchedGroupIds) {
      for (const descendantId of getDescendantGroupIds(gid, groups)) {
        expandedGroupIds.add(descendantId);
      }
      for (const ancestorId of getAncestorGroupIds(gid, groups)) {
        expandedGroupIds.add(ancestorId);
      }
    }

    switch (filterScope) {
      case 'group':
        expandedGroupIds.forEach((id) => visibleGroupIds.add(id));
        for (const item of items) {
          itemVisibility.set(item.id, !!(item.groupId && expandedGroupIds.has(item.groupId)));
        }
        break;

      case 'item':
        for (const item of items) {
          const matches = includesAll(itemNameText(item), keywords);
          itemVisibility.set(item.id, matches);
          if (matches && item.groupId) addGroupWithAncestors(item.groupId);
        }
        break;

      case 'all':
      default:
        for (const item of items) {
          // 語はアイテム名とグループ名（親を含む）にまたがって当ててよい（例: 「株 xlsm」）
          const itemMatches = includesAll(
            `${itemNameText(item)}\n${groupPathText(item.groupId)}`,
            keywords
          );
          const groupMatches = !!(item.groupId && expandedGroupIds.has(item.groupId));

          if (itemMatches || groupMatches) {
            itemVisibility.set(item.id, true);
            if (item.groupId) addGroupWithAncestors(item.groupId);
          } else {
            itemVisibility.set(item.id, false);
          }
        }
        expandedGroupIds.forEach((id) => visibleGroupIds.add(id));
        break;
    }

    return {
      visibleGroupIds: visibleGroupIds.size > 0 ? visibleGroupIds : null,
      itemVisibility,
    };
    // searchNormalization は parseKeywords・normalizeForSearch の中で読む設定。変わったら絞り直す
  }, [groups, items, filterText, filterScope, searchNormalization]);
}
