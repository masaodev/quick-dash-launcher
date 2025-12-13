import { ipcMain, shell, BrowserWindow } from 'electron';
import logger from '@common/logger';
import type { AppItem, WorkspaceItem, WorkspaceGroup } from '@common/types';
import {
  WORKSPACE_LOAD_ITEMS,
  WORKSPACE_ADD_ITEM,
  WORKSPACE_ADD_ITEMS_FROM_PATHS,
  WORKSPACE_REMOVE_ITEM,
  WORKSPACE_UPDATE_DISPLAY_NAME,
  WORKSPACE_REORDER_ITEMS,
  WORKSPACE_LAUNCH_ITEM,
  WORKSPACE_LOAD_GROUPS,
  WORKSPACE_CREATE_GROUP,
  WORKSPACE_UPDATE_GROUP,
  WORKSPACE_DELETE_GROUP,
  WORKSPACE_REORDER_GROUPS,
  WORKSPACE_MOVE_ITEM_TO_GROUP,
  WORKSPACE_CHANGED,
} from '@common/ipcChannels';
import { parseArgs } from '@common/utils/argsParser';

import { WorkspaceService } from '../services/workspaceService.js';

/**
 * ワークスペース変更イベントを全てのウィンドウに送信
 */
function notifyWorkspaceChanged(): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((window) => {
    window.webContents.send(WORKSPACE_CHANGED);
  });
}

/**
 * ワークスペース関連のIPCハンドラーを設定
 */
export function setupWorkspaceHandlers(): void {
  /**
   * ワークスペースアイテムを全て取得
   */
  ipcMain.handle(WORKSPACE_LOAD_ITEMS, async () => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      const items = await workspaceService.loadItems();
      logger.info({ count: items.length }, 'Loaded workspace items');
      return items;
    } catch (error) {
      logger.error({ error }, 'Failed to load workspace items');
      throw error;
    }
  });

  /**
   * ワークスペースにアイテムを追加
   */
  ipcMain.handle(WORKSPACE_ADD_ITEM, async (_event, item: AppItem) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      const addedItem = await workspaceService.addItem(item);
      logger.info({ id: addedItem.id, name: addedItem.displayName }, 'Added item to workspace');
      notifyWorkspaceChanged();
      return addedItem;
    } catch (error) {
      logger.error({ error }, 'Failed to add item to workspace');
      throw error;
    }
  });

  /**
   * ファイルパスからワークスペースにアイテムを追加
   */
  ipcMain.handle(WORKSPACE_ADD_ITEMS_FROM_PATHS, async (_event, filePaths: string[]) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      const addedItems: WorkspaceItem[] = [];

      for (const filePath of filePaths) {
        try {
          const addedItem = await workspaceService.addItemFromPath(filePath);
          addedItems.push(addedItem);
          logger.info(
            { id: addedItem.id, name: addedItem.displayName, path: filePath },
            'Added item from path to workspace'
          );
        } catch (error) {
          logger.error({ error, path: filePath }, 'Failed to add item from path');
          // 個別のエラーは記録するが、処理は継続
        }
      }

      if (addedItems.length > 0) {
        notifyWorkspaceChanged();
      }

      return addedItems;
    } catch (error) {
      logger.error({ error }, 'Failed to add items from paths to workspace');
      throw error;
    }
  });

  /**
   * ワークスペースからアイテムを削除
   */
  ipcMain.handle(WORKSPACE_REMOVE_ITEM, async (_event, id: string) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.removeItem(id);
      logger.info({ id }, 'Removed item from workspace');
      notifyWorkspaceChanged();
      return { success: true };
    } catch (error) {
      logger.error({ error, id }, 'Failed to remove item from workspace');
      throw error;
    }
  });

  /**
   * ワークスペースアイテムの表示名を更新
   */
  ipcMain.handle(WORKSPACE_UPDATE_DISPLAY_NAME, async (_event, id: string, displayName: string) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.updateDisplayName(id, displayName);
      logger.info({ id, displayName }, 'Updated workspace item display name');
      notifyWorkspaceChanged();
      return { success: true };
    } catch (error) {
      logger.error({ error, id }, 'Failed to update workspace item display name');
      throw error;
    }
  });

  /**
   * ワークスペースアイテムの並び順を変更
   */
  ipcMain.handle(WORKSPACE_REORDER_ITEMS, async (_event, itemIds: string[]) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.reorderItems(itemIds);
      logger.info({ count: itemIds.length }, 'Reordered workspace items');
      notifyWorkspaceChanged();
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to reorder workspace items');
      throw error;
    }
  });

  /**
   * ワークスペースアイテムを起動
   */
  ipcMain.handle(WORKSPACE_LAUNCH_ITEM, async (_event, item: WorkspaceItem) => {
    try {
      // WorkspaceItemを起動
      if (item.type === 'url') {
        await shell.openExternal(item.path);
      } else if (item.type === 'file' || item.type === 'folder') {
        await shell.openPath(item.path);
      } else if (item.type === 'app') {
        // ショートカットファイルの場合
        if (item.path.endsWith('.lnk')) {
          await shell.openPath(item.path);
        } else if (item.args) {
          // 引数を配列として処理
          const args = parseArgs(item.args);
          const { spawn } = await import('child_process');
          const child = spawn(item.path, args, {
            detached: true,
            stdio: 'ignore',
          });
          child.unref();
        } else {
          await shell.openPath(item.path);
        }
      } else if (item.type === 'customUri') {
        await shell.openExternal(item.path);
      }

      logger.info(
        { id: item.id, name: item.displayName, path: item.path },
        'Launched workspace item'
      );
      return { success: true };
    } catch (error) {
      logger.error({ error, id: item.id, path: item.path }, 'Failed to launch workspace item');
      throw error;
    }
  });

  // ==================== グループ管理ハンドラー ====================

  /**
   * ワークスペースグループを全て取得
   */
  ipcMain.handle(WORKSPACE_LOAD_GROUPS, async () => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      const groups = await workspaceService.loadGroups();
      logger.info({ count: groups.length }, 'Loaded workspace groups');
      return groups;
    } catch (error) {
      logger.error({ error }, 'Failed to load workspace groups');
      throw error;
    }
  });

  /**
   * 新しいグループを作成
   */
  ipcMain.handle(WORKSPACE_CREATE_GROUP, async (_event, name: string, color?: string) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      const group = await workspaceService.createGroup(name, color);
      logger.info({ id: group.id, name: group.name }, 'Created workspace group');
      notifyWorkspaceChanged();
      return group;
    } catch (error) {
      logger.error({ error, name }, 'Failed to create workspace group');
      throw error;
    }
  });

  /**
   * グループを更新
   */
  ipcMain.handle(
    WORKSPACE_UPDATE_GROUP,
    async (_event, id: string, updates: Partial<WorkspaceGroup>) => {
      try {
        const workspaceService = await WorkspaceService.getInstance();
        await workspaceService.updateGroup(id, updates);
        logger.info({ id, updates }, 'Updated workspace group');
        notifyWorkspaceChanged();
        return { success: true };
      } catch (error) {
        logger.error({ error, id }, 'Failed to update workspace group');
        throw error;
      }
    }
  );

  /**
   * グループを削除
   */
  ipcMain.handle(WORKSPACE_DELETE_GROUP, async (_event, id: string, deleteItems: boolean) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.deleteGroup(id, deleteItems);
      logger.info({ id, deleteItems }, 'Deleted workspace group');
      notifyWorkspaceChanged();
      return { success: true };
    } catch (error) {
      logger.error({ error, id }, 'Failed to delete workspace group');
      throw error;
    }
  });

  /**
   * グループの並び順を変更
   */
  ipcMain.handle(WORKSPACE_REORDER_GROUPS, async (_event, groupIds: string[]) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.reorderGroups(groupIds);
      logger.info({ count: groupIds.length }, 'Reordered workspace groups');
      notifyWorkspaceChanged();
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to reorder workspace groups');
      throw error;
    }
  });

  /**
   * アイテムをグループに移動
   */
  ipcMain.handle(WORKSPACE_MOVE_ITEM_TO_GROUP, async (_event, itemId: string, groupId?: string) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.moveItemToGroup(itemId, groupId);
      logger.info({ itemId, groupId }, 'Moved item to group');
      notifyWorkspaceChanged();
      return { success: true };
    } catch (error) {
      logger.error({ error, itemId, groupId }, 'Failed to move item to group');
      throw error;
    }
  });

  logger.info('Workspace IPC handlers registered');
}
