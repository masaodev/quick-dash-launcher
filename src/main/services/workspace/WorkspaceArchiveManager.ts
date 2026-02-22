/**
 * ワークスペースアーカイブの管理を担当するマネージャークラス
 */
import type {
  WorkspaceItem,
  WorkspaceGroup,
  ArchivedWorkspaceGroup,
  ArchivedWorkspaceItem,
} from '@common/types';
import logger from '@common/logger';
import { getDescendantGroupIds } from '@common/utils/groupTreeUtils';

import type { WorkspaceStoreInstance, ArchiveStoreInstance } from './types.js';
import { migrateGroupDisplayName } from './migrationUtils.js';

/**
 * ワークスペースのアーカイブ操作を担当するクラス
 */
export class WorkspaceArchiveManager {
  private store: WorkspaceStoreInstance;
  private archiveStore: ArchiveStoreInstance;

  constructor(store: WorkspaceStoreInstance, archiveStore: ArchiveStoreInstance) {
    this.store = store;
    this.archiveStore = archiveStore;
  }

  /**
   * グループとそのアイテムをアーカイブ（子孫サブグループも含む）
   * @param groupId アーカイブするグループのID
   * @param groups 現在のグループ一覧
   * @param items 現在のアイテム一覧
   */
  public archiveGroup(groupId: string, groups: WorkspaceGroup[], items: WorkspaceItem[]): void {
    try {
      const group = groups.find((g) => g.id === groupId);
      if (!group) {
        logger.warn({ groupId }, 'Group not found in workspace');
        throw new Error(`Group not found: ${groupId}`);
      }

      // 子孫サブグループIDも含めたアーカイブ対象を収集
      const descendantIds = getDescendantGroupIds(groupId, groups);
      const allGroupIds = new Set([groupId, ...descendantIds]);

      // 対象グループとそのアイテムを検索
      const targetGroups = groups.filter((g) => allGroupIds.has(g.id));
      const targetItems = items.filter((item) => item.groupId && allGroupIds.has(item.groupId));

      // アーカイブデータを作成（メインのグループ情報）
      const archivedGroup: ArchivedWorkspaceGroup = {
        ...group,
        archivedAt: Date.now(),
        originalOrder: group.order,
        itemCount: targetItems.length,
      };

      // サブグループもアーカイブ
      const archivedSubgroups: ArchivedWorkspaceGroup[] = targetGroups
        .filter((g) => g.id !== groupId)
        .map((g) => ({
          ...g,
          archivedAt: Date.now(),
          originalOrder: g.order,
          itemCount: items.filter((item) => item.groupId === g.id).length,
        }));

      const archivedItems: ArchivedWorkspaceItem[] = targetItems.map((item) => ({
        ...item,
        archivedAt: Date.now(),
        archivedGroupId: item.groupId!,
      }));

      // アーカイブストアに追加
      const archivedGroupsInStore = this.archiveStore.get('groups') || [];
      const archivedItemsInStore = this.archiveStore.get('items') || [];

      archivedGroupsInStore.push(archivedGroup, ...archivedSubgroups);
      archivedItemsInStore.push(...archivedItems);

      this.archiveStore.set('groups', archivedGroupsInStore);
      this.archiveStore.set('items', archivedItemsInStore);

      // ワークスペースから削除
      const remainingGroups = groups.filter((g) => !allGroupIds.has(g.id));
      const remainingItems = items.filter(
        (item) => !item.groupId || !allGroupIds.has(item.groupId)
      );

      this.store.set('groups', remainingGroups);
      this.store.set('items', remainingItems);

      logger.info(
        {
          groupId,
          groupName: group.displayName,
          itemCount: targetItems.length,
          subgroupCount: descendantIds.length,
        },
        'Archived group (with descendants) and its items'
      );
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to archive group');
      throw error;
    }
  }

  /**
   * アーカイブされたグループ一覧を取得
   * @returns アーカイブされたグループの配列（アーカイブ日時の新しい順）
   */
  public loadArchivedGroups(): ArchivedWorkspaceGroup[] {
    try {
      const groups = this.archiveStore.get('groups') || [];

      const { migratedGroups, needsMigration } = migrateGroupDisplayName(groups, 'archived groups');

      if (needsMigration) {
        this.archiveStore.set('groups', migratedGroups);
      }

      return migratedGroups.sort((a, b) => b.archivedAt - a.archivedAt);
    } catch (error) {
      logger.error({ error }, 'Failed to load archived groups');
      return [];
    }
  }

  /**
   * アーカイブされたグループのアイテムを取得
   * @param groupId グループID
   * @returns アーカイブされたアイテムの配列
   */
  public getArchivedItemsByGroup(groupId: string): ArchivedWorkspaceItem[] {
    try {
      const items = this.archiveStore.get('items') || [];
      return items.filter((item) => item.archivedGroupId === groupId);
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to get archived items by group');
      return [];
    }
  }

  /**
   * アーカイブされたグループとそのアイテムを復元（サブグループも含む）
   * @param groupId 復元するグループのID
   * @param currentGroups 現在のグループ一覧
   * @param currentItems 現在のアイテム一覧
   * @returns 復元されたグループとアイテム
   */
  public restoreGroup(
    groupId: string,
    currentGroups: WorkspaceGroup[],
    currentItems: WorkspaceItem[]
  ): { restoredGroup: WorkspaceGroup; restoredItems: WorkspaceItem[] } {
    try {
      const archivedGroups = this.archiveStore.get('groups') || [];
      const archivedItems = this.archiveStore.get('items') || [];

      // アーカイブからメイングループを検索
      const archivedGroup = archivedGroups.find((g) => g.id === groupId);
      if (!archivedGroup) {
        logger.warn({ groupId }, 'Archived group not found');
        throw new Error(`Archived group not found: ${groupId}`);
      }

      // サブグループも検索（parentGroupIdで紐付いているもの）
      const archivedSubgroups = this.findArchivedDescendantGroups(groupId, archivedGroups);
      const allArchivedGroupIds = new Set([groupId, ...archivedSubgroups.map((g) => g.id)]);

      // 全対象グループのアイテムを検索
      const allArchivedItems = archivedItems.filter((item) =>
        allArchivedGroupIds.has(item.archivedGroupId)
      );

      // グループ名の重複チェック
      let restoredGroupName = archivedGroup.displayName;
      const existingNames = currentGroups.map((g) => g.displayName);
      if (existingNames.includes(restoredGroupName)) {
        restoredGroupName = `${restoredGroupName} (復元)`;
        logger.info(
          { originalName: archivedGroup.displayName, newName: restoredGroupName },
          'Group name was duplicated, added suffix'
        );
      }

      // 新しいorder値を計算（末尾に追加）
      const maxGroupOrder =
        currentGroups.length > 0 ? Math.max(...currentGroups.map((g) => g.order)) : -1;
      const maxItemOrder =
        currentItems.length > 0 ? Math.max(...currentItems.map((i) => i.order)) : -1;

      // 親グループが存在するか確認、なければトップレベルに
      const parentExists = archivedGroup.parentGroupId
        ? currentGroups.some((g) => g.id === archivedGroup.parentGroupId)
        : true;

      // メイングループを復元
      const restoredGroup: WorkspaceGroup = {
        id: archivedGroup.id,
        displayName: restoredGroupName,
        color: archivedGroup.color,
        order: maxGroupOrder + 1,
        collapsed: archivedGroup.collapsed,
        createdAt: archivedGroup.createdAt,
        parentGroupId: parentExists ? archivedGroup.parentGroupId : undefined,
      };

      // サブグループを復元
      const restoredSubgroups: WorkspaceGroup[] = archivedSubgroups.map((sg) => ({
        id: sg.id,
        displayName: sg.displayName,
        color: sg.color,
        order: sg.order,
        collapsed: sg.collapsed,
        createdAt: sg.createdAt,
        parentGroupId: sg.parentGroupId,
      }));

      // アイテムを復元（アーカイブ関連プロパティを削除）
      const restoredItems: WorkspaceItem[] = allArchivedItems.map((item, index) => {
        const {
          archivedAt: _archivedAt,
          archivedGroupId: _archivedGroupId,
          ...workspaceItem
        } = item;
        return {
          ...workspaceItem,
          order: maxItemOrder + 1 + index,
        };
      });

      // ワークスペースに追加
      const updatedGroups = [...currentGroups, restoredGroup, ...restoredSubgroups];
      const updatedItems = [...currentItems, ...restoredItems];

      this.store.set('groups', updatedGroups);
      this.store.set('items', updatedItems);

      // アーカイブから削除
      const remainingArchivedGroups = archivedGroups.filter((g) => !allArchivedGroupIds.has(g.id));
      const remainingArchivedItems = archivedItems.filter(
        (item) => !allArchivedGroupIds.has(item.archivedGroupId)
      );

      this.archiveStore.set('groups', remainingArchivedGroups);
      this.archiveStore.set('items', remainingArchivedItems);

      logger.info(
        {
          groupId,
          groupName: restoredGroupName,
          itemCount: restoredItems.length,
          subgroupCount: restoredSubgroups.length,
        },
        'Restored group (with descendants) and its items from archive'
      );

      return { restoredGroup, restoredItems };
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to restore group from archive');
      throw error;
    }
  }

  /**
   * アーカイブ内の子孫サブグループを再帰的に検索
   */
  private findArchivedDescendantGroups(
    groupId: string,
    archivedGroups: ArchivedWorkspaceGroup[]
  ): ArchivedWorkspaceGroup[] {
    const children = archivedGroups.filter((g) => g.parentGroupId === groupId);
    return children.flatMap((child) => [
      child,
      ...this.findArchivedDescendantGroups(child.id, archivedGroups),
    ]);
  }

  /**
   * アーカイブされたグループとそのアイテムを完全削除
   * @param groupId 削除するグループのID
   */
  public deleteArchivedGroup(groupId: string): void {
    try {
      const archivedGroups = this.archiveStore.get('groups') || [];
      const archivedItems = this.archiveStore.get('items') || [];

      // グループが存在するか確認
      const group = archivedGroups.find((g) => g.id === groupId);
      if (!group) {
        logger.warn({ groupId }, 'Archived group not found');
        return;
      }

      // アーカイブから削除
      const remainingArchivedGroups = archivedGroups.filter((g) => g.id !== groupId);
      const remainingArchivedItems = archivedItems.filter(
        (item) => item.archivedGroupId !== groupId
      );

      this.archiveStore.set('groups', remainingArchivedGroups);
      this.archiveStore.set('items', remainingArchivedItems);

      logger.info({ groupId, groupName: group.displayName }, 'Deleted archived group permanently');
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to delete archived group');
      throw error;
    }
  }

  /**
   * アーカイブをクリア
   */
  public clear(): void {
    try {
      this.archiveStore.set('groups', []);
      this.archiveStore.set('items', []);
      logger.info('Cleared all archived groups and items');
    } catch (error) {
      logger.error({ error }, 'Failed to clear archive');
      throw error;
    }
  }
}
