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

import type { WorkspaceFileStore } from './WorkspaceFileStore.js';

/**
 * ワークスペースのアーカイブ操作を担当するクラス
 *
 * アーカイブ・復元は workspace.json と workspace-archive.json の両方を書き換えるので、
 * store.updateBoth() で 1 トランザクションにする。
 */
export class WorkspaceArchiveManager {
  constructor(private readonly store: WorkspaceFileStore) {}

  private get archiveStore() {
    return this.store.archiveStore;
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

      // ワークスペースから削除
      const remainingGroups = groups.filter((g) => !allGroupIds.has(g.id));
      const remainingItems = items.filter(
        (item) => !item.groupId || !allGroupIds.has(item.groupId)
      );

      this.store.updateBoth((main, archive) => {
        archive.groups.push(archivedGroup, ...archivedSubgroups);
        archive.items.push(...archivedItems);
        main.groups = remainingGroups;
        main.items = remainingItems;
      });

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
    return this.archiveStore.get('groups').sort((a, b) => b.archivedAt - a.archivedAt);
  }

  /**
   * アーカイブされたグループのアイテムを取得
   * @param groupId グループID
   * @returns アーカイブされたアイテムの配列
   */
  public getArchivedItemsByGroup(groupId: string): ArchivedWorkspaceItem[] {
    return this.archiveStore.get('items').filter((item) => item.archivedGroupId === groupId);
  }

  /**
   * アーカイブされたグループとそのアイテムを復元（サブグループも含む）
   * @param groupId 復元するグループのID
   * @param currentGroups 現在のグループ一覧
   * @param currentItems 現在のアイテム一覧
   * @param options.targetWorkspaceId 指定時はこのワークスペースに復元（parentGroupIdもクリア）
   * @returns 復元されたグループとアイテム
   */
  public restoreGroup(
    groupId: string,
    currentGroups: WorkspaceGroup[],
    currentItems: WorkspaceItem[],
    options?: { targetWorkspaceId?: string }
  ): { restoredGroup: WorkspaceGroup; restoredItems: WorkspaceItem[] } {
    try {
      const archivedGroups = this.archiveStore.get('groups');
      const archivedItems = this.archiveStore.get('items');
      const targetWorkspaceId = options?.targetWorkspaceId;
      const knownWorkspaceIds = new Set(this.store.get('workspaces').map((w) => w.id));

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

      // グループ名の重複チェック（ワークスペース移動時はスキップ）
      let restoredGroupName = archivedGroup.displayName;
      if (!targetWorkspaceId) {
        const existingNames = currentGroups.map((g) => g.displayName);
        if (existingNames.includes(restoredGroupName)) {
          restoredGroupName = `${restoredGroupName} (復元)`;
          logger.info(
            { originalName: archivedGroup.displayName, newName: restoredGroupName },
            'Group name was duplicated, added suffix'
          );
        }
      }

      // 新しいorder値を計算（末尾に追加）
      const maxGroupOrder =
        currentGroups.length > 0 ? Math.max(...currentGroups.map((g) => g.order)) : -1;
      const maxItemOrder =
        currentItems.length > 0 ? Math.max(...currentItems.map((i) => i.order)) : -1;

      // 親グループが存在するか確認、なければトップレベルに
      const parentExists =
        !targetWorkspaceId && archivedGroup.parentGroupId
          ? currentGroups.some((g) => g.id === archivedGroup.parentGroupId)
          : false;

      // メイングループを復元（アーカイブ専用フィールドを除去）
      const {
        archivedAt: _mainArchivedAt,
        originalOrder: _mainOriginalOrder,
        itemCount: _mainItemCount,
        ...mainGroupFields
      } = archivedGroup;
      // 復元先ワークスペース: 指定があればそれ、無ければ元の所属。どちらも無ければ既定
      const resolveWorkspaceId = (original: string): string => {
        if (targetWorkspaceId) return targetWorkspaceId;
        return knownWorkspaceIds.has(original) ? original : this.store.resolveDefaultWorkspaceId();
      };

      const { parentGroupId: _mainParent, ...mainGroupRest } = mainGroupFields;
      const restoredGroup: WorkspaceGroup = {
        ...mainGroupRest,
        displayName: restoredGroupName,
        workspaceId: resolveWorkspaceId(mainGroupFields.workspaceId),
        order: maxGroupOrder + 1,
        ...(parentExists && { parentGroupId: archivedGroup.parentGroupId }),
      };

      // サブグループを復元（アーカイブ専用フィールドを除去）
      const restoredSubgroups: WorkspaceGroup[] = archivedSubgroups.map(
        ({ archivedAt: _a, originalOrder: _o, itemCount: _c, ...sgFields }) => ({
          ...sgFields,
          workspaceId: resolveWorkspaceId(sgFields.workspaceId),
        })
      );

      // アイテムを復元（アーカイブ関連プロパティを削除）
      const restoredItems: WorkspaceItem[] = allArchivedItems.map((item, index) => {
        const {
          archivedAt: _archivedAt,
          archivedGroupId: _archivedGroupId,
          ...workspaceItem
        } = item;
        return {
          ...workspaceItem,
          workspaceId: resolveWorkspaceId(workspaceItem.workspaceId),
          order: maxItemOrder + 1 + index,
        } as WorkspaceItem;
      });

      // ワークスペースに追加し、アーカイブから削除（1 トランザクション）
      const updatedGroups = [...currentGroups, restoredGroup, ...restoredSubgroups];
      const updatedItems = [...currentItems, ...restoredItems];

      this.store.updateBoth((main, archive) => {
        main.groups = updatedGroups;
        main.items = updatedItems;
        archive.groups = archivedGroups.filter((g) => !allArchivedGroupIds.has(g.id));
        archive.items = archivedItems.filter(
          (item) => !allArchivedGroupIds.has(item.archivedGroupId)
        );
      });

      logger.info(
        {
          groupId,
          groupName: restoredGroupName,
          targetWorkspaceId,
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
      const archivedGroups = this.archiveStore.get('groups');

      // グループが存在するか確認
      const group = archivedGroups.find((g) => g.id === groupId);
      if (!group) {
        logger.warn({ groupId }, 'Archived group not found');
        return;
      }

      // アーカイブから削除（子孫サブグループとそのアイテムも）
      const descendantIds = this.findArchivedDescendantGroups(groupId, archivedGroups).map(
        (g) => g.id
      );
      const deleteIds = new Set([groupId, ...descendantIds]);
      this.store.updateArchive((archive) => {
        archive.groups = archive.groups.filter((g) => !deleteIds.has(g.id));
        archive.items = archive.items.filter((item) => !deleteIds.has(item.archivedGroupId));
      });

      logger.info({ groupId, groupName: group.displayName }, 'Deleted archived group permanently');
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to delete archived group');
      throw error;
    }
  }

  /**
   * 全アーカイブアイテムを取得
   */
  public getAllArchivedItems(): ArchivedWorkspaceItem[] {
    return this.archiveStore.get('items');
  }

  /**
   * アーカイブアイテムを指定ワークスペースに復元
   */
  public restoreItemToWorkspace(
    itemId: string,
    targetWorkspaceId: string,
    currentItems: WorkspaceItem[]
  ): void {
    const archivedItems = this.archiveStore.get('items');
    const archivedItem = archivedItems.find((i) => i.id === itemId);
    if (!archivedItem) {
      throw new Error(`Archived item not found: ${itemId}`);
    }

    const maxOrder = currentItems.length > 0 ? Math.max(...currentItems.map((i) => i.order)) : -1;
    const {
      archivedAt: _archivedAt,
      archivedGroupId: _archivedGroupId,
      groupId: _groupId,
      ...workspaceItem
    } = archivedItem;
    const restoredItem = {
      ...workspaceItem,
      workspaceId: targetWorkspaceId,
      order: maxOrder + 1,
    } as WorkspaceItem;

    this.store.updateBoth((main, archive) => {
      main.items = [...currentItems, restoredItem];
      archive.items = archive.items.filter((i) => i.id !== itemId);
    });

    logger.info({ itemId, targetWorkspaceId }, 'Restored archived item to workspace');
  }
}
