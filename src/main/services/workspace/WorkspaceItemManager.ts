/**
 * ワークスペースアイテムのCRUD操作を管理するマネージャークラス
 */
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import type { AppItem, WorkspaceItem } from '@common/types.js';
import logger from '@common/logger.js';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector.js';
import { isWindowInfo, isGroupItem } from '@common/types/guards.js';

import type { WorkspaceStoreInstance } from './types.js';

/**
 * ワークスペースアイテムの管理を担当するクラス
 */
export class WorkspaceItemManager {
  private store: WorkspaceStoreInstance;

  constructor(store: WorkspaceStoreInstance) {
    this.store = store;
  }

  /**
   * 全てのワークスペースアイテムを取得
   * @returns ワークスペースアイテムの配列（order順にソート済み）
   */
  public loadItems(): WorkspaceItem[] {
    try {
      const items = this.store.get('items') || [];
      return items.sort((a, b) => a.order - b.order);
    } catch (error) {
      logger.error({ error }, 'Failed to load workspace items');
      return [];
    }
  }

  /**
   * アイテムをワークスペースに追加
   * @param item 追加するアイテム（LauncherItem or WindowOperationItem or GroupItem）
   * @param groupId オプションのグループID
   * @returns 追加されたWorkspaceItem
   */
  public addItem(item: AppItem, groupId?: string): WorkspaceItem {
    try {
      const items = this.loadItems();

      if (isWindowInfo(item)) {
        throw new Error('WindowInfo is not supported in workspace');
      }

      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.order)) : -1;

      let workspaceItem: WorkspaceItem;

      if (item.type === 'windowOperation') {
        workspaceItem = this.createWindowOperationItem(item, maxOrder + 1, groupId);
      } else if (isGroupItem(item)) {
        workspaceItem = this.createGroupItem(item, maxOrder + 1, groupId);
      } else {
        workspaceItem = this.createLauncherItem(item, maxOrder + 1, groupId);
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

  /**
   * WindowOperationItemからWorkspaceItemを作成
   */
  private createWindowOperationItem(item: AppItem, order: number, groupId?: string): WorkspaceItem {
    const windowOpItem = item as {
      type: 'windowOperation';
      name: string;
      windowTitle: string;
      processName?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      virtualDesktopNumber?: number;
      activateWindow?: boolean;
      moveToActiveMonitorCenter?: boolean;
    };

    return {
      id: randomUUID(),
      displayName: windowOpItem.name,
      originalName: windowOpItem.name,
      path: `[ウィンドウ操作: ${windowOpItem.windowTitle}]`,
      type: 'windowOperation',
      order,
      addedAt: Date.now(),
      groupId,
      processName: windowOpItem.processName,
      windowX: windowOpItem.x,
      windowY: windowOpItem.y,
      windowWidth: windowOpItem.width,
      windowHeight: windowOpItem.height,
      virtualDesktopNumber: windowOpItem.virtualDesktopNumber,
      activateWindow: windowOpItem.activateWindow,
      moveToActiveMonitorCenter: windowOpItem.moveToActiveMonitorCenter,
    };
  }

  /**
   * GroupItemからWorkspaceItemを作成
   */
  private createGroupItem(item: AppItem, order: number, groupId?: string): WorkspaceItem {
    const groupItem = item as { name: string; itemNames?: string[] };
    const itemNames = groupItem.itemNames || [];

    logger.info(
      {
        groupName: groupItem.name,
        originalItemNames: groupItem.itemNames,
        itemNamesLength: itemNames.length,
      },
      'Adding group item to workspace'
    );

    return {
      id: randomUUID(),
      displayName: groupItem.name,
      originalName: groupItem.name,
      path: `[グループ: ${itemNames.length}件]`,
      type: 'group',
      order,
      addedAt: Date.now(),
      groupId,
      itemNames,
    };
  }

  /**
   * LauncherItemからWorkspaceItemを作成
   */
  private createLauncherItem(item: AppItem, order: number, groupId?: string): WorkspaceItem {
    const launcherItem = item as {
      name: string;
      path: string;
      type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
      icon?: string;
      customIcon?: string;
      args?: string;
      originalPath?: string;
      windowConfig?: import('../../../common/types/launcher.js').WindowConfig;
    };

    return {
      id: randomUUID(),
      displayName: launcherItem.name,
      originalName: launcherItem.name,
      path: launcherItem.path,
      type: launcherItem.type,
      icon: launcherItem.icon,
      customIcon: launcherItem.customIcon,
      args: launcherItem.args,
      originalPath: launcherItem.originalPath,
      order,
      addedAt: Date.now(),
      groupId,
      windowConfig: launcherItem.windowConfig,
    };
  }

  /**
   * ファイルパスからワークスペースにアイテムを追加
   */
  public addItemFromPath(filePath: string, icon?: string, groupId?: string): WorkspaceItem {
    try {
      const items = this.loadItems();

      if (!fs.existsSync(filePath)) {
        throw new Error(`File or folder does not exist: ${filePath}`);
      }

      const itemType = detectItemTypeSync(filePath);
      const fileName = path.basename(filePath);
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.order)) : -1;

      const workspaceItem: WorkspaceItem = {
        id: randomUUID(),
        displayName: fileName,
        originalName: fileName,
        path: filePath,
        type: itemType,
        icon,
        order: maxOrder + 1,
        addedAt: Date.now(),
        groupId,
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

  /**
   * ワークスペースからアイテムを削除
   */
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

  /**
   * アイテムの表示名を更新
   */
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
   * アイテムの並び順を変更
   */
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

  /**
   * 指定したグループのアイテムを取得
   */
  public getItemsByGroup(groupId?: string): WorkspaceItem[] {
    try {
      const items = this.loadItems();
      return items.filter((item) => item.groupId === groupId);
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to get items by group');
      return [];
    }
  }

  /**
   * アイテムをグループに移動
   */
  public moveItemToGroup(itemId: string, groupId?: string, groups?: { id: string }[]): void {
    try {
      const items = this.loadItems();
      const item = items.find((i) => i.id === itemId);

      if (!item) {
        logger.warn({ itemId }, 'Item not found in workspace');
        throw new Error(`Item not found: ${itemId}`);
      }

      if (groupId && groups) {
        const group = groups.find((g) => g.id === groupId);
        if (!group) {
          logger.warn({ groupId }, 'Group not found in workspace');
          throw new Error(`Group not found: ${groupId}`);
        }
      }

      if (groupId) {
        item.groupId = groupId;
      } else {
        delete item.groupId;
      }

      this.store.set('items', items);
      logger.info({ itemId, groupId }, 'Moved item to group');
    } catch (error) {
      logger.error({ error, itemId, groupId }, 'Failed to move item to group');
      throw error;
    }
  }

  /**
   * 全アイテムをクリア
   */
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
