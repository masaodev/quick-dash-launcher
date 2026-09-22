/**
 * ワークスペースグループのCRUD操作を管理するマネージャークラス
 */
import type { WorkspaceGroup, WorkspaceGroupUpdate, WorkspaceItem } from '@common/types';
import logger from '@common/logger';
import {
  canCreateSubgroup,
  getDescendantGroupIds,
  getGroupDepth,
  getSubtreeMaxDepth,
  MAX_GROUP_DEPTH,
} from '@common/utils/groupTreeUtils';
import { getDefaultGroupColor, isValidGroupColor } from '@common/groupColors';

import type { WorkspaceFileStore } from './WorkspaceFileStore.js';

/**
 * ワークスペースグループの管理を担当するクラス
 *
 * 折りたたみ状態はここでは扱わない（UI 状態として WorkspaceUiStateStore が持つ）。
 */
export class WorkspaceGroupManager {
  constructor(private readonly store: WorkspaceFileStore) {}

  /**
   * 全てのワークスペースグループを取得
   * @returns ワークスペースグループの配列（order順にソート済み）
   */
  public loadGroups(): WorkspaceGroup[] {
    return this.store.get('groups').sort((a, b) => a.order - b.order);
  }

  /**
   * 新しいグループを作成
   * @param name グループ名
   * @param color グループの色（省略時は階層に応じたデフォルト色）
   * @param parentGroupId 親グループID（省略時はトップレベル）
   * @returns 作成されたWorkspaceGroup
   */
  public createGroup(
    name: string,
    color?: string,
    parentGroupId?: string,
    workspaceId?: string
  ): WorkspaceGroup {
    try {
      const groups = this.loadGroups();

      // 親グループが指定された場合、存在確認と深さバリデーション
      const parentGroup = parentGroupId ? groups.find((g) => g.id === parentGroupId) : undefined;
      if (parentGroupId) {
        if (!parentGroup) {
          throw new Error(`Parent group not found: ${parentGroupId}`);
        }
        if (!canCreateSubgroup(parentGroupId, groups)) {
          throw new Error('Maximum subgroup depth exceeded');
        }
      }
      const depth = parentGroupId ? getGroupDepth(parentGroupId, groups) + 1 : 0;
      const resolvedColor =
        color !== undefined && isValidGroupColor(color) ? color : getDefaultGroupColor(depth);

      // parentGroupIdがある場合、親のworkspaceIdを継承。どちらも無ければ既定ワークスペース
      const resolvedWorkspaceId =
        workspaceId ?? parentGroup?.workspaceId ?? this.store.resolveDefaultWorkspaceId();

      // 同一親内での最大orderを計算
      const siblingGroups = groups.filter((g) => g.parentGroupId === parentGroupId);
      const maxOrder =
        siblingGroups.length > 0 ? Math.max(...siblingGroups.map((g) => g.order)) : -1;

      const workspaceGroup: WorkspaceGroup = {
        id: this.store.newId(),
        displayName: name,
        color: resolvedColor,
        order: maxOrder + 1,
        createdAt: Date.now(),
        workspaceId: resolvedWorkspaceId,
        ...(parentGroupId !== undefined && { parentGroupId }),
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
  public updateGroup(id: string, updates: WorkspaceGroupUpdate): void {
    try {
      const groups = this.loadGroups();
      const group = groups.find((g) => g.id === id);

      if (!group) {
        logger.warn({ id }, 'Group not found in workspace');
        throw new Error(`Group not found: ${id}`);
      }

      // 更新可能なフィールドのみ更新（id, order, createdAt, workspaceId は除外）
      if (updates.displayName !== undefined) group.displayName = updates.displayName;
      if (updates.color !== undefined) {
        if (!isValidGroupColor(updates.color)) {
          throw new Error(`Invalid group color: ${updates.color}`);
        }
        group.color = updates.color;
      }
      // 親の変更は moveGroupToParent と同じ検証（循環・深さ）を通す
      if ('parentGroupId' in updates && updates.parentGroupId !== group.parentGroupId) {
        this.applyParentMove(group, updates.parentGroupId, groups);
      }

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

      this.store.update((main) => {
        main.groups = filteredGroups;
        main.items = updatedItems;
      });

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
      this.applyParentMove(group, newParentGroupId, groups);

      this.store.set('groups', groups);
      logger.info({ groupId, newParentGroupId }, 'Moved group to new parent');
    } catch (error) {
      logger.error({ error, groupId, newParentGroupId }, 'Failed to move group to parent');
      throw error;
    }
  }

  /**
   * 親グループを付け替える（循環参照・深さを検証し、新しい親内の末尾に置く）
   * @param group 移動するグループ（groups 内の要素をその場で変更する）
   * @param newParentGroupId 新しい親グループID（undefinedならトップレベル）
   */
  private applyParentMove(
    group: WorkspaceGroup,
    newParentGroupId: string | undefined,
    groups: WorkspaceGroup[]
  ): void {
    if (newParentGroupId) {
      // 親グループの存在確認
      if (!groups.some((g) => g.id === newParentGroupId)) {
        throw new Error(`Parent group not found: ${newParentGroupId}`);
      }

      // 循環参照防止: 自分自身または自分の子孫には移動できない
      const selfAndDescendants = new Set([group.id, ...getDescendantGroupIds(group.id, groups)]);
      if (selfAndDescendants.has(newParentGroupId)) {
        throw new Error('Cannot move a group into its own descendant');
      }

      // 深さバリデーション: 移動先でMAX_GROUP_DEPTHを超えないか確認
      const newParentDepth = getGroupDepth(newParentGroupId, groups);
      const subtreeDepth = getSubtreeMaxDepth(group.id, groups);
      if (newParentDepth + 1 + subtreeDepth > MAX_GROUP_DEPTH) {
        throw new Error('Moving this group would exceed maximum depth');
      }
    }

    // 新しい親グループ内での末尾orderを計算
    const siblings = groups.filter(
      (g) => g.parentGroupId === newParentGroupId && g.id !== group.id
    );
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((g) => g.order)) : -1;

    if (newParentGroupId === undefined) delete group.parentGroupId;
    else group.parentGroupId = newParentGroupId;
    group.order = maxOrder + 1;
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
   * グループIDからグループを取得
   * @param groupId グループID
   * @returns グループまたはundefined
   */
  public getGroupById(groupId: string): WorkspaceGroup | undefined {
    const groups = this.loadGroups();
    return groups.find((g) => g.id === groupId);
  }
}
