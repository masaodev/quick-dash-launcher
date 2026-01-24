/**
 * ワークスペースグループのCRUD操作を管理するマネージャークラス
 */
import { randomUUID } from 'crypto';

import type { WorkspaceGroup, WorkspaceItem } from '@common/types';
import logger from '@common/logger';

import type { WorkspaceStoreInstance } from './types.js';

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

      // 旧データの name → displayName マイグレーション
      let needsMigration = false;
      const migratedGroups = groups.map((group) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawGroup = group as any;
        if (rawGroup.name !== undefined && rawGroup.displayName === undefined) {
          needsMigration = true;
          const { name, ...rest } = rawGroup;
          return { ...rest, displayName: name } as WorkspaceGroup;
        }
        return group;
      });

      // マイグレーションが必要な場合、ストアを更新
      if (needsMigration) {
        this.store.set('groups', migratedGroups);
        logger.info('Migrated workspace groups: name → displayName');
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
   * @param color グループの色（デフォルト: var(--color-primary)）
   * @returns 作成されたWorkspaceGroup
   */
  public createGroup(name: string, color: string = 'var(--color-primary)'): WorkspaceGroup {
    try {
      const groups = this.loadGroups();
      const maxOrder = groups.length > 0 ? Math.max(...groups.map((g) => g.order)) : -1;

      const workspaceGroup: WorkspaceGroup = {
        id: randomUUID(),
        displayName: name,
        color,
        order: maxOrder + 1,
        collapsed: false,
        createdAt: Date.now(),
      };

      groups.push(workspaceGroup);
      this.store.set('groups', groups);
      logger.info({ id: workspaceGroup.id, name: workspaceGroup.displayName }, 'Created workspace group');

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

      this.store.set('groups', groups);
      logger.info({ id, updates }, 'Updated workspace group');
    } catch (error) {
      logger.error({ error, id }, 'Failed to update workspace group');
      throw error;
    }
  }

  /**
   * グループを削除
   * @param id 削除するグループのID
   * @param deleteItems グループ内のアイテムも削除するか（false: 未分類に移動）
   * @param items 現在のアイテム一覧
   * @returns 更新されたアイテム一覧
   */
  public deleteGroup(id: string, deleteItems: boolean, items: WorkspaceItem[]): WorkspaceItem[] {
    try {
      const groups = this.loadGroups();
      const filteredGroups = groups.filter((group) => group.id !== id);

      if (groups.length === filteredGroups.length) {
        logger.warn({ id }, 'Group not found in workspace');
        return items;
      }

      let updatedItems: WorkspaceItem[];

      if (deleteItems) {
        // アイテムも削除
        updatedItems = items.filter((item) => item.groupId !== id);
        logger.info(
          { id, deletedItems: items.length - updatedItems.length },
          'Deleted group and its items'
        );
      } else {
        // アイテムを未分類に移動（groupIdをundefinedに）
        updatedItems = items.map((item) => {
          if (item.groupId === id) {
            const { groupId: _, ...rest } = item;
            return rest;
          }
          return item;
        });
        logger.info({ id }, 'Deleted group and moved items to uncategorized');
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
   * グループの並び順を変更
   * @param groupIds 新しい順序でのグループIDの配列
   */
  public reorderGroups(groupIds: string[]): void {
    try {
      const groups = this.loadGroups();
      const groupMap = new Map(groups.map((group) => [group.id, group]));
      const reorderedGroups: WorkspaceGroup[] = [];

      groupIds.forEach((id, index) => {
        const group = groupMap.get(id);
        if (group) {
          group.order = index;
          reorderedGroups.push(group);
        }
      });

      // groupIdsに含まれていないグループも保持（末尾に追加）
      groups.forEach((group) => {
        if (!groupIds.includes(group.id)) {
          group.order = reorderedGroups.length;
          reorderedGroups.push(group);
        }
      });

      this.store.set('groups', reorderedGroups);
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
