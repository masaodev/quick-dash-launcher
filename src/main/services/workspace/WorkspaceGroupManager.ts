/**
 * ワークスペースグループのCRUD操作を管理するマネージャークラス
 */
import { randomUUID } from 'crypto';

import type { WorkspaceGroup, WorkspaceItem } from '@common/types';
import logger from '@common/logger';
import {
  canCreateSubgroup,
  getDescendantGroupIds,
  getGroupDepth,
  getSubtreeMaxDepth,
  MAX_GROUP_DEPTH,
} from '@common/utils/groupTreeUtils';
import { getDefaultGroupColor } from '@common/constants';

import type { WorkspaceStoreInstance } from './types.js';
import { migrateGroupDisplayName } from './migrationUtils.js';

/**
 * ワークスペースグループの管理を担当するクラス
 */
export class WorkspaceGroupManager {
  private store: WorkspaceStoreInstance;

  constructor(store: WorkspaceStoreInstance) {
    this.store = store;
  }

  /**
   * 全てのワークスペースグループを取得
   * @returns ワークスペースグループの配列（order順にソート済み）
   */
  public loadGroups(): WorkspaceGroup[] {
    try {
      const groups = this.store.get('groups') || [];

      const { migratedGroups, needsMigration } = migrateGroupDisplayName(
        groups,
        'workspace groups'
      );

      if (needsMigration) {
        this.store.set('groups', migratedGroups);
      }

      return migratedGroups.sort((a, b) => a.order - b.order);
    } catch (error) {
      logger.error({ error }, 'Failed to load workspace groups');
      return [];
    }
  }

  /**
   * 新しいグループを作成
   * @param name グループ名
   * @param color グループの色（省略時は階層に応じたデフォルト色）
   * @param parentGroupId 親グループID（省略時はトップレベル）
   * @returns 作成されたWorkspaceGroup
   */
  public createGroup(name: string, color?: string, parentGroupId?: string): WorkspaceGroup {
    try {
      const groups = this.loadGroups();

      // 親グループが指定された場合、深さバリデーション
      if (parentGroupId) {
        const parentExists = groups.some((g) => g.id === parentGroupId);
        if (!parentExists) {
          throw new Error(`Parent group not found: ${parentGroupId}`);
        }
        if (!canCreateSubgroup(parentGroupId, groups)) {
          throw new Error('Maximum subgroup depth exceeded');
        }
      }

      const depth = parentGroupId ? getGroupDepth(parentGroupId, groups) + 1 : 0;
      const resolvedColor = color ?? getDefaultGroupColor(depth);

      // 同一親内での最大orderを計算
      const siblingGroups = groups.filter((g) => g.parentGroupId === parentGroupId);
      const maxOrder =
        siblingGroups.length > 0 ? Math.max(...siblingGroups.map((g) => g.order)) : -1;

      const workspaceGroup: WorkspaceGroup = {
        id: randomUUID(),
        displayName: name,
        color: resolvedColor,
        order: maxOrder + 1,
        collapsed: false,
        createdAt: Date.now(),
        parentGroupId,
      };

      groups.push(workspaceGroup);
      this.store.set('groups', groups);
      logger.info(
        { id: workspaceGroup.id, name: workspaceGroup.displayName, parentGroupId },
        'Created workspace group'
      );

      return workspaceGroup;
    } catch (error) {
      logger.error({ error, name }, 'Failed to create workspace group');
      throw error;
    }
  }

  /**
   * グループを更新
   * @param id 更新するグループのID
   * @param updates 更新する内容
   */
  public updateGroup(id: string, updates: Partial<WorkspaceGroup>): void {
    try {
      const groups = this.loadGroups();
      const group = groups.find((g) => g.id === id);

      if (!group) {
        logger.warn({ id }, 'Group not found in workspace');
        throw new Error(`Group not found: ${id}`);
      }

      // 更新可能なフィールドのみ更新（id, order, createdAtは除外）
      if (updates.displayName !== undefined) group.displayName = updates.displayName;
      if (updates.color !== undefined) group.color = updates.color;
      if (updates.collapsed !== undefined) group.collapsed = updates.collapsed;
      if (updates.parentGroupId !== undefined) group.parentGroupId = updates.parentGroupId;
      if (updates.customIcon !== undefined) group.customIcon = updates.customIcon;

      this.store.set('groups', groups);
      logger.info({ id, updates }, 'Updated workspace group');
    } catch (error) {
      logger.error({ error, id }, 'Failed to update workspace group');
      throw error;
    }
  }

  /**
   * グループを削除（子孫サブグループも連鎖削除）
   * @param id 削除するグループのID
   * @param deleteItems グループ内のアイテムも削除するか（false: 未分類に移動）
   * @param items 現在のアイテム一覧
   * @returns 更新されたアイテム一覧
   */
  public deleteGroup(id: string, deleteItems: boolean, items: WorkspaceItem[]): WorkspaceItem[] {
    try {
      const groups = this.loadGroups();

      if (!groups.some((g) => g.id === id)) {
        logger.warn({ id }, 'Group not found in workspace');
        return items;
      }

      // 子孫サブグループIDも含めた削除対象を収集
      const descendantIds = getDescendantGroupIds(id, groups);
      const allDeleteIds = new Set([id, ...descendantIds]);

      const filteredGroups = groups.filter((group) => !allDeleteIds.has(group.id));

      let updatedItems: WorkspaceItem[];

      if (deleteItems) {
        // アイテムも削除
        updatedItems = items.filter((item) => !item.groupId || !allDeleteIds.has(item.groupId));
        logger.info(
          {
            id,
            deletedItems: items.length - updatedItems.length,
            descendantCount: descendantIds.length,
          },
          'Deleted group (with descendants) and its items'
        );
      } else {
        // アイテムを未分類に移動（groupIdをundefinedに）
        updatedItems = items.map((item) => {
          if (item.groupId && allDeleteIds.has(item.groupId)) {
            const { groupId: _, ...rest } = item;
            return rest;
          }
          return item;
        });
        logger.info(
          { id, descendantCount: descendantIds.length },
          'Deleted group (with descendants) and moved items to uncategorized'
        );
      }

      this.store.set('groups', filteredGroups);
      this.store.set('items', updatedItems);

      return updatedItems;
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete workspace group');
      throw error;
    }
  }

  /**
   * グループを別の親グループに移動（循環参照・深さバリデーション付き）
   * @param groupId 移動するグループのID
   * @param newParentGroupId 新しい親グループID（undefinedならトップレベルに移動）
   */
  public moveGroupToParent(groupId: string, newParentGroupId?: string): void {
    try {
      const groups = this.loadGroups();
      const group = groups.find((g) => g.id === groupId);

      if (!group) {
        throw new Error(`Group not found: ${groupId}`);
      }

      // 同じ親への移動は何もしない
      if (group.parentGroupId === newParentGroupId) {
        return;
      }

      if (newParentGroupId) {
        // 親グループの存在確認
        if (!groups.some((g) => g.id === newParentGroupId)) {
          throw new Error(`Parent group not found: ${newParentGroupId}`);
        }

        // 循環参照防止: 自分自身または自分の子孫には移動できない
        const selfAndDescendants = new Set([groupId, ...getDescendantGroupIds(groupId, groups)]);
        if (selfAndDescendants.has(newParentGroupId)) {
          throw new Error('Cannot move a group into its own descendant');
        }

        // 深さバリデーション: 移動先でMAX_GROUP_DEPTHを超えないか確認
        const newParentDepth = getGroupDepth(newParentGroupId, groups);
        const subtreeDepth = getSubtreeMaxDepth(groupId, groups);
        if (newParentDepth + 1 + subtreeDepth > MAX_GROUP_DEPTH) {
          throw new Error('Moving this group would exceed maximum depth');
        }
      }

      // 新しい親グループ内での末尾orderを計算
      const siblings = groups.filter(
        (g) => g.parentGroupId === newParentGroupId && g.id !== groupId
      );
      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((g) => g.order)) : -1;

      group.parentGroupId = newParentGroupId;
      group.order = maxOrder + 1;

      this.store.set('groups', groups);
      logger.info({ groupId, newParentGroupId }, 'Moved group to new parent');
    } catch (error) {
      logger.error({ error, groupId, newParentGroupId }, 'Failed to move group to parent');
      throw error;
    }
  }

  /**
   * グループの並び順を変更（同一親グループ内での並び替え）
   * @param groupIds 新しい順序でのグループIDの配列
   */
  public reorderGroups(groupIds: string[]): void {
    try {
      const groups = this.loadGroups();
      const groupMap = new Map(groups.map((group) => [group.id, group]));
      const groupIdSet = new Set(groupIds);

      // 指定されたIDの順序でグループを並べ、含まれていないグループは変更なし
      const orderedGroups = groupIds
        .map((id) => groupMap.get(id))
        .filter((group): group is WorkspaceGroup => group !== undefined);

      // 並び替え対象のグループにのみ新しいorderを付与
      orderedGroups.forEach((group, index) => {
        group.order = index;
      });

      // 非対象グループはそのまま保持
      const remainingGroups = groups.filter((group) => !groupIdSet.has(group.id));

      this.store.set('groups', [...orderedGroups, ...remainingGroups]);
      logger.info({ count: groupIds.length }, 'Reordered workspace groups');
    } catch (error) {
      logger.error({ error }, 'Failed to reorder workspace groups');
      throw error;
    }
  }

  /**
   * 指定グループのorderを個別更新
   * @param orderMap グループID -> 新しいorder のマップ
   */
  public updateGroupOrders(orderMap: Map<string, number>): void {
    try {
      const groups = this.loadGroups();
      let updated = 0;

      for (const group of groups) {
        const newOrder = orderMap.get(group.id);
        if (newOrder !== undefined) {
          group.order = newOrder;
          updated++;
        }
      }

      if (updated > 0) {
        this.store.set('groups', groups);
        logger.info({ count: updated }, 'Updated group orders');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to update group orders');
      throw error;
    }
  }

  /**
   * 複数グループのcollapsed状態を一括更新
   * @param ids 更新するグループIDの配列
   * @param collapsed 設定するcollapsed状態
   */
  public setGroupsCollapsed(ids: string[], collapsed: boolean): void {
    try {
      const groups = this.loadGroups();
      const idSet = new Set(ids);
      let updated = 0;

      for (const group of groups) {
        if (idSet.has(group.id)) {
          group.collapsed = collapsed;
          updated++;
        }
      }

      if (updated > 0) {
        this.store.set('groups', groups);
        logger.info({ count: updated, collapsed }, 'Batch updated groups collapsed state');
      }
    } catch (error) {
      logger.error({ error, ids, collapsed }, 'Failed to batch update groups collapsed state');
      throw error;
    }
  }

  /**
   * グループIDからグループを取得
   * @param groupId グループID
   * @returns グループまたはundefined
   */
  public getGroupById(groupId: string): WorkspaceGroup | undefined {
    const groups = this.loadGroups();
    return groups.find((g) => g.id === groupId);
  }

  /**
   * 全グループをクリア
   */
  public clear(): void {
    try {
      this.store.set('groups', []);
      logger.info('Cleared all workspace groups');
    } catch (error) {
      logger.error({ error }, 'Failed to clear workspace groups');
      throw error;
    }
  }
}
