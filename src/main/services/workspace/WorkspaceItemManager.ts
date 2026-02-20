import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import type {
  AppItem,
  ClipboardItem,
  GroupItem,
  LauncherItem,
  WindowItem,
  WorkspaceItem,
} from '@common/types';
import logger from '@common/logger';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { isWindowInfo, isWindowItem, isGroupItem, isClipboardItem } from '@common/types/guards';

import type { WorkspaceStoreInstance } from './types.js';

export class WorkspaceItemManager {
  private store: WorkspaceStoreInstance;

  constructor(store: WorkspaceStoreInstance) {
    this.store = store;
  }

  private getNextOrder(items: WorkspaceItem[]): number {
    return items.length > 0 ? Math.max(...items.map((i) => i.order)) + 1 : 0;
  }

  public loadItems(): WorkspaceItem[] {
    try {
      const items = this.store.get('items') || [];
      return items.sort((a, b) => a.order - b.order);
    } catch (error) {
      logger.error({ error }, 'Failed to load workspace items');
      return [];
    }
  }

  public addItem(item: AppItem, groupId?: string): WorkspaceItem {
    try {
      const items = this.loadItems();

      if (isWindowInfo(item)) {
        throw new Error('WindowInfo is not supported in workspace');
      }

      const order = this.getNextOrder(items);
      let workspaceItem: WorkspaceItem;

      if (isWindowItem(item)) {
        workspaceItem = this.createWindowItem(item, order, groupId);
      } else if (isGroupItem(item)) {
        workspaceItem = this.createGroupItem(item, order, groupId);
      } else if (isClipboardItem(item)) {
        workspaceItem = this.createClipboardItem(item, order, groupId);
      } else {
        workspaceItem = this.createLauncherItem(item, order, groupId);
      }

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

  private createBaseFields(
    displayName: string,
    order: number,
    groupId?: string
  ): Pick<WorkspaceItem, 'id' | 'displayName' | 'originalName' | 'order' | 'addedAt' | 'groupId'> {
    return {
      id: randomUUID(),
      displayName,
      originalName: displayName,
      order,
      addedAt: Date.now(),
      groupId,
    };
  }

  private createWindowItem(item: WindowItem, order: number, groupId?: string): WorkspaceItem {
    return {
      ...this.createBaseFields(item.displayName, order, groupId),
      path: `[ウィンドウ操作: ${item.windowTitle}]`,
      type: 'windowOperation',
      processName: item.processName,
      windowX: item.x,
      windowY: item.y,
      windowWidth: item.width,
      windowHeight: item.height,
      virtualDesktopNumber: item.virtualDesktopNumber,
      activateWindow: item.activateWindow,
      moveToActiveMonitorCenter: item.moveToActiveMonitorCenter,
      pinToAllDesktops: item.pinToAllDesktops,
    };
  }

  private createGroupItem(item: GroupItem, order: number, groupId?: string): WorkspaceItem {
    logger.info(
      { groupName: item.displayName, itemNamesLength: item.itemNames.length },
      'Adding group item to workspace'
    );

    return {
      ...this.createBaseFields(item.displayName, order, groupId),
      path: `[グループ: ${item.itemNames.length}件]`,
      type: 'group',
      itemNames: item.itemNames,
    };
  }

  private createClipboardItem(item: ClipboardItem, order: number, groupId?: string): WorkspaceItem {
    return {
      ...this.createBaseFields(item.displayName, order, groupId),
      path: `[クリップボード: ${item.preview?.substring(0, 20) || 'データ'}...]`,
      type: 'clipboard',
      customIcon: item.customIcon,
      clipboardDataRef: item.clipboardDataRef,
      clipboardFormats: item.formats,
      clipboardSavedAt: item.savedAt,
      memo: item.memo,
    };
  }

  private createLauncherItem(item: LauncherItem, order: number, groupId?: string): WorkspaceItem {
    return {
      ...this.createBaseFields(item.displayName, order, groupId),
      path: item.path,
      type: item.type,
      customIcon: item.customIcon,
      args: item.args,
      originalPath: item.originalPath,
      windowConfig: item.windowConfig,
    };
  }

  public addItemFromPath(filePath: string, groupId?: string): WorkspaceItem {
    try {
      const items = this.loadItems();

      if (!fs.existsSync(filePath)) {
        throw new Error(`File or folder does not exist: ${filePath}`);
      }

      const itemType = detectItemTypeSync(filePath);
      const fileName = path.basename(filePath);

      const workspaceItem: WorkspaceItem = {
        ...this.createBaseFields(fileName, this.getNextOrder(items), groupId),
        path: filePath,
        type: itemType,
      };

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

  public updateItem(id: string, updates: Partial<WorkspaceItem>): void {
    try {
      const items = this.loadItems();
      const itemIndex = items.findIndex((i) => i.id === id);

      if (itemIndex === -1) {
        logger.warn({ id }, 'Item not found in workspace');
        throw new Error(`Item not found: ${id}`);
      }

      const existing = items[itemIndex];
      items[itemIndex] = {
        ...existing,
        ...updates,
        id: existing.id,
        order: existing.order,
        addedAt: existing.addedAt,
        groupId: existing.groupId,
      };

      this.store.set('items', items);
      logger.info({ id, updates }, 'Updated workspace item');
    } catch (error) {
      logger.error({ error, id }, 'Failed to update workspace item');
      throw error;
    }
  }

  public reorderItems(itemIds: string[]): void {
    try {
      const items = this.loadItems();
      const itemMap = new Map(items.map((item) => [item.id, item]));
      const reorderedItems: WorkspaceItem[] = [];

      itemIds.forEach((id, index) => {
        const item = itemMap.get(id);
        if (item) {
          item.order = index;
          reorderedItems.push(item);
        }
      });

      items.forEach((item) => {
        if (!itemIds.includes(item.id)) {
          item.order = reorderedItems.length;
          reorderedItems.push(item);
        }
      });

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

  public getItemsByGroup(groupId?: string): WorkspaceItem[] {
    try {
      const items = this.loadItems();
      return items.filter((item) => item.groupId === groupId);
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to get items by group');
      return [];
    }
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

      item.groupId = groupId;

      this.store.set('items', items);
      logger.info({ itemId, groupId }, 'Moved item to group');
    } catch (error) {
      logger.error({ error, itemId, groupId }, 'Failed to move item to group');
      throw error;
    }
  }

  public clear(): void {
    try {
      this.store.set('items', []);
      logger.info('Cleared all workspace items');
    } catch (error) {
      logger.error({ error }, 'Failed to clear workspace');
      throw error;
    }
  }
}
