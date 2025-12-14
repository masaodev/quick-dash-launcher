import { useMemo } from 'react';
import type { WorkspaceItem } from '@common/types';

/**
 * ワークスペースアイテムのグループ化ロジックを管理するカスタムフック
 *
 * アイテムをグループIDごとに分類し、未分類アイテムを特定します。
 *
 * @param items ワークスペースアイテム配列
 * @returns グループ別アイテムマップと未分類アイテム配列
 *
 * @example
 * ```tsx
 * const { itemsByGroup, uncategorizedItems } = useWorkspaceItemGroups(items);
 *
 * // グループIDでアイテムを取得
 * const groupItems = itemsByGroup[groupId] || [];
 *
 * // 未分類アイテムを取得
 * console.log(uncategorizedItems.length);
 * ```
 */
export function useWorkspaceItemGroups(items: WorkspaceItem[]) {
  /**
   * グループIDごとにアイテムを分類
   */
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

  /**
   * 未分類のアイテム
   */
  const uncategorizedItems = useMemo(() => {
    return itemsByGroup['uncategorized'] || [];
  }, [itemsByGroup]);

  return {
    itemsByGroup,
    uncategorizedItems,
  };
}
