import * as fs from 'fs';
import * as path from 'path';

import type { AppItem, WorkspaceItem, WorkspaceItemUpdate } from '@common/types';
import logger from '@common/logger';
import { appItemToWorkspaceItemBody } from '@common/utils/workspaceConverters';

import type { WorkspaceFileStore } from './WorkspaceFileStore.js';
import { resolveLauncherType } from './WorkspaceFileStore.js';

/**
 * ワークスペースアイテムの管理
 *
 * アイテムの本体（type 固有のフィールド）は appItemToWorkspaceItemBody / WorkspaceItemUpdate で受け取り、
 * ここでは id・並び順・所属（workspaceId / groupId）を付けてストアに書く。
 */
export class WorkspaceItemManager {
  constructor(private readonly store: WorkspaceFileStore) {}

  private getNextOrder(items: WorkspaceItem[]): number {
    return items.length > 0 ? Math.max(...items.map((i) => i.order)) + 1 : 0;
  }

  public loadItems(): WorkspaceItem[] {
    return this.store.get('items').sort((a, b) => a.order - b.order);
  }

  /**
   * 本体にメタ情報を付けて実行時アイテムにする
   */
  private materialize(
    body: WorkspaceItemUpdate,
    meta: { order: number; groupId?: string; workspaceId?: string }
  ): WorkspaceItem {
    const item = {
      id: this.store.newId(),
      ...body,
      workspaceId: meta.workspaceId || this.store.resolveDefaultWorkspaceId(),
      ...(meta.groupId !== undefined && { groupId: meta.groupId }),
      order: meta.order,
      addedAt: Date.now(),
    } as WorkspaceItem;
    if (item.type === 'item') {
      item.launcherType = resolveLauncherType(item);
    }
    return item;
  }

  public addItem(item: AppItem, groupId?: string, workspaceId?: string): WorkspaceItem {
    try {
      const items = this.loadItems();
      const workspaceItem = this.materialize(appItemToWorkspaceItemBody(item), {
        order: this.getNextOrder(items),
        groupId,
        workspaceId,
      });

      items.push(workspaceItem);
      this.store.set('items', items);

      logger.info(
        { id: workspaceItem.id, name: workspaceItem.displayName, groupId },
        'Added item to workspace'
      );
      return workspaceItem;
    } catch (error) {
      logger.error({ error }, 'Failed to add workspace item');
      throw error;
    }
  }

  public addItemFromPath(filePath: string, groupId?: string, workspaceId?: string): WorkspaceItem {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File or folder does not exist: ${filePath}`);
      }

      const items = this.loadItems();
      const workspaceItem = this.materialize(
        { type: 'item', displayName: path.basename(filePath), path: filePath },
        { order: this.getNextOrder(items), groupId, workspaceId }
      );

      items.push(workspaceItem);
      this.store.set('items', items);

      logger.info(
        { id: workspaceItem.id, name: workspaceItem.displayName, path: filePath, groupId },
        'Added item from path to workspace'
      );
      return workspaceItem;
    } catch (error) {
      logger.error({ error, path: filePath }, 'Failed to add workspace item from path');
      throw error;
    }
  }

  public removeItem(id: string): void {
    try {
      const items = this.loadItems();
      const filteredItems = items.filter((item) => item.id !== id);

      if (items.length === filteredItems.length) {
        logger.warn({ id }, 'Item not found in workspace');
        return;
      }

      this.store.set('items', filteredItems);
      logger.info({ id }, 'Removed item from workspace');
    } catch (error) {
      logger.error({ error, id }, 'Failed to remove workspace item');
      throw error;
    }
  }

  public updateDisplayName(id: string, displayName: string): void {
    try {
      const items = this.loadItems();
      const item = items.find((i) => i.id === id);

      if (!item) {
        logger.warn({ id }, 'Item not found in workspace');
        throw new Error(`Item not found: ${id}`);
      }

      item.displayName = displayName;
      this.store.set('items', items);
      logger.info({ id, displayName }, 'Updated workspace item display name');
    } catch (error) {
      logger.error({ error, id }, 'Failed to update workspace item display name');
      throw error;
    }
  }

  /**
   * アイテムの本体を置き換える（id・並び順・所属は保つ）
   */
  public updateItem(id: string, update: WorkspaceItemUpdate): void {
    try {
      const items = this.loadItems();
      const itemIndex = items.findIndex((i) => i.id === id);

      if (itemIndex === -1) {
        logger.warn({ id }, 'Item not found in workspace');
        throw new Error(`Item not found: ${id}`);
      }

      const existing = items[itemIndex];
      const replaced = {
        id: existing.id,
        ...update,
        workspaceId: existing.workspaceId,
        ...(existing.groupId !== undefined && { groupId: existing.groupId }),
        order: existing.order,
        addedAt: existing.addedAt,
      } as WorkspaceItem;
      if (replaced.type === 'item') {
        replaced.launcherType = resolveLauncherType(replaced);
      }
      items[itemIndex] = replaced;

      this.store.set('items', items);
      logger.info({ id, type: update.type }, 'Updated workspace item');
    } catch (error) {
      logger.error({ error, id }, 'Failed to update workspace item');
      throw error;
    }
  }

  public reorderItems(itemIds: string[]): void {
    try {
      const items = this.loadItems();
      const itemMap = new Map(items.map((item) => [item.id, item]));
      const itemIdSet = new Set(itemIds);
      const reorderedItems: WorkspaceItem[] = [];

      for (let i = 0; i < itemIds.length; i++) {
        const item = itemMap.get(itemIds[i]);
        if (item) {
          item.order = i;
          reorderedItems.push(item);
        }
      }

      for (const item of items) {
        if (!itemIdSet.has(item.id)) {
          item.order = reorderedItems.length;
          reorderedItems.push(item);
        }
      }

      this.store.set('items', reorderedItems);
      logger.info({ count: itemIds.length }, 'Reordered workspace items');
    } catch (error) {
      logger.error({ error }, 'Failed to reorder workspace items');
      throw error;
    }
  }

  public updateItemOrders(orderMap: Map<string, number>): void {
    try {
      const items = this.loadItems();
      let updated = 0;

      for (const item of items) {
        const newOrder = orderMap.get(item.id);
        if (newOrder !== undefined) {
          item.order = newOrder;
          updated++;
        }
      }

      if (updated > 0) {
        this.store.set('items', items);
        logger.info({ count: updated }, 'Updated item orders');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to update item orders');
      throw error;
    }
  }

  public duplicateItem(
    sourceItemId: string,
    targetGroupId?: string,
    insertOrder?: number
  ): WorkspaceItem {
    try {
      const items = this.loadItems();
      const sourceItem = items.find((i) => i.id === sourceItemId);

      if (!sourceItem) {
        throw new Error(`Item not found: ${sourceItemId}`);
      }

      let order: number;
      if (insertOrder !== undefined) {
        // 指定位置に挿入: 既存アイテムのorderをずらす
        for (const item of items) {
          if (item.order >= insertOrder) {
            item.order++;
          }
        }
        order = insertOrder;
      } else {
        order = this.getNextOrder(items);
      }

      const duplicatedItem: WorkspaceItem = {
        ...sourceItem,
        id: this.store.newId(),
        addedAt: Date.now(),
        order,
        groupId: targetGroupId !== undefined ? targetGroupId : sourceItem.groupId,
      };

      items.push(duplicatedItem);
      this.store.set('items', items);

      logger.info(
        { sourceId: sourceItemId, newId: duplicatedItem.id, targetGroupId },
        'Duplicated workspace item'
      );
      return duplicatedItem;
    } catch (error) {
      logger.error({ error, sourceItemId }, 'Failed to duplicate workspace item');
      throw error;
    }
  }

  public getItemsByGroup(groupId?: string): WorkspaceItem[] {
    return this.loadItems().filter((item) => item.groupId === groupId);
  }

  public moveItemToGroup(itemId: string, groupId?: string, groups?: { id: string }[]): void {
    try {
      const items = this.loadItems();
      const item = items.find((i) => i.id === itemId);

      if (!item) {
        logger.warn({ itemId }, 'Item not found in workspace');
        throw new Error(`Item not found: ${itemId}`);
      }

      if (groupId && groups && !groups.some((g) => g.id === groupId)) {
        logger.warn({ groupId }, 'Group not found in workspace');
        throw new Error(`Group not found: ${groupId}`);
      }

      if (groupId === undefined) delete item.groupId;
      else item.groupId = groupId;

      this.store.set('items', items);
      logger.info({ itemId, groupId }, 'Moved item to group');
    } catch (error) {
      logger.error({ error, itemId, groupId }, 'Failed to move item to group');
      throw error;
    }
  }
}
