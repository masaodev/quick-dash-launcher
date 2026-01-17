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

import type { WorkspaceStoreInstance, ArchiveStoreInstance } from './types.js';

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
   * グループとそのアイテムをアーカイブ
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

      // グループ内のアイテムを検索
      const groupItems = items.filter((item) => item.groupId === groupId);

      // アーカイブデータを作成
      const archivedGroup: ArchivedWorkspaceGroup = {
        ...group,
        archivedAt: Date.now(),
        originalOrder: group.order,
        itemCount: groupItems.length,
      };

      const archivedItems: ArchivedWorkspaceItem[] = groupItems.map((item) => ({
        ...item,
        archivedAt: Date.now(),
        archivedGroupId: groupId,
      }));

      // アーカイブストアに追加
      const archivedGroups = this.archiveStore.get('groups') || [];
      const archivedItemsInStore = this.archiveStore.get('items') || [];

      archivedGroups.push(archivedGroup);
      archivedItemsInStore.push(...archivedItems);

      this.archiveStore.set('groups', archivedGroups);
      this.archiveStore.set('items', archivedItemsInStore);

      // ワークスペースから削除
      const remainingGroups = groups.filter((g) => g.id !== groupId);
      const remainingItems = items.filter((item) => item.groupId !== groupId);

      this.store.set('groups', remainingGroups);
      this.store.set('items', remainingItems);

      logger.info(
        { groupId, groupName: group.name, itemCount: groupItems.length },
        'Archived group and its items'
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
      return groups.sort((a, b) => b.archivedAt - a.archivedAt);
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
   * アーカイブされたグループとそのアイテムを復元
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

      // アーカイブからグループを検索
      const archivedGroup = archivedGroups.find((g) => g.id === groupId);
      if (!archivedGroup) {
        logger.warn({ groupId }, 'Archived group not found');
        throw new Error(`Archived group not found: ${groupId}`);
      }

      // アーカイブからアイテムを検索
      const groupArchivedItems = archivedItems.filter((item) => item.archivedGroupId === groupId);

      // グループ名の重複チェック
      let restoredGroupName = archivedGroup.name;
      const existingNames = currentGroups.map((g) => g.name);
      if (existingNames.includes(restoredGroupName)) {
        restoredGroupName = `${restoredGroupName} (復元)`;
        logger.info(
          { originalName: archivedGroup.name, newName: restoredGroupName },
          'Group name was duplicated, added suffix'
        );
      }

      // 新しいorder値を計算（末尾に追加）
      const maxGroupOrder =
        currentGroups.length > 0 ? Math.max(...currentGroups.map((g) => g.order)) : -1;
      const maxItemOrder =
        currentItems.length > 0 ? Math.max(...currentItems.map((i) => i.order)) : -1;

      // グループを復元
      const restoredGroup: WorkspaceGroup = {
        id: archivedGroup.id,
        name: restoredGroupName,
        color: archivedGroup.color,
        order: maxGroupOrder + 1,
        collapsed: archivedGroup.collapsed,
        createdAt: archivedGroup.createdAt,
      };

      // アイテムを復元（アーカイブ関連プロパティを削除）
      const restoredItems: WorkspaceItem[] = groupArchivedItems.map((item, index) => {
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
      const updatedGroups = [...currentGroups, restoredGroup];
      const updatedItems = [...currentItems, ...restoredItems];

      this.store.set('groups', updatedGroups);
      this.store.set('items', updatedItems);

      // アーカイブから削除
      const remainingArchivedGroups = archivedGroups.filter((g) => g.id !== groupId);
      const remainingArchivedItems = archivedItems.filter(
        (item) => item.archivedGroupId !== groupId
      );

      this.archiveStore.set('groups', remainingArchivedGroups);
      this.archiveStore.set('items', remainingArchivedItems);

      logger.info(
        { groupId, groupName: restoredGroupName, itemCount: restoredItems.length },
        'Restored group and its items from archive'
      );

      return { restoredGroup, restoredItems };
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to restore group from archive');
      throw error;
    }
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

      logger.info({ groupId, groupName: group.name }, 'Deleted archived group permanently');
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
