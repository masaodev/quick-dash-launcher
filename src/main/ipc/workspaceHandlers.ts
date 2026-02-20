import { ipcMain, BrowserWindow } from 'electron';
import logger from '@common/logger';
import type { AppItem, WorkspaceItem, WorkspaceGroup, MixedOrderEntry } from '@common/types';
import { isLauncherItem, isWindowItem } from '@common/types/guards';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import { tryActivateWindow } from '../utils/windowActivator.js';
import { launchItem } from '../utils/itemLauncher.js';
import { WorkspaceService } from '../services/workspace/index.js';
import PathManager from '../config/pathManager.js';
import { getIconForItem } from '../services/iconService.js';

import { loadDataFiles } from './dataHandlers.js';

/**
 * ワークスペース変更イベントを全てのウィンドウに送信
 */
export function notifyWorkspaceChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IPC_CHANNELS.WORKSPACE_CHANGED);
  }
}

/**
 * ワークスペース関連のIPCハンドラーを設定
 */
export function setupWorkspaceHandlers(): void {
  /**
   * ワークスペースアイテムを全て取得
   */
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LOAD_ITEMS, async () => {
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
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_ADD_ITEM,
    async (_event, item: AppItem, groupId?: string) => {
      try {
        const workspaceService = await WorkspaceService.getInstance();
        const addedItem = await workspaceService.addItem(item, groupId);
        logger.info(
          { id: addedItem.id, name: addedItem.displayName, groupId },
          'Added item to workspace'
        );
        notifyWorkspaceChanged();
        return addedItem;
      } catch (error) {
        logger.error({ error }, 'Failed to add item to workspace');
        throw error;
      }
    }
  );

  /**
   * ファイルパスからワークスペースにアイテムを追加
   * アイテムタイプに応じてアイコンを自動取得する
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_ADD_ITEMS_FROM_PATHS,
    async (_event, filePaths: string[], groupId?: string) => {
      try {
        const workspaceService = await WorkspaceService.getInstance();
        const addedItems: WorkspaceItem[] = [];

        // アイコンキャッシュフォルダのパスを取得
        const iconsFolder = PathManager.getAppsFolder();
        const extensionsFolder = PathManager.getExtensionsFolder();

        for (const filePath of filePaths) {
          try {
            const itemType = detectItemTypeSync(filePath);

            // アイコンをキャッシュに保存（アイコンはキャッシュフォルダから参照される）
            await getIconForItem(filePath, itemType, iconsFolder, extensionsFolder);

            const addedItem = await workspaceService.addItemFromPath(filePath, groupId);
            addedItems.push(addedItem);
            logger.info(
              { id: addedItem.id, name: addedItem.displayName, path: filePath, type: itemType },
              'Added item from path to workspace'
            );
          } catch (error) {
            logger.error({ error, path: filePath }, 'Failed to add item from path');
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
    }
  );

  /**
   * ワークスペースからアイテムを削除
   */
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REMOVE_ITEM, async (_event, id: string) => {
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
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_UPDATE_DISPLAY_NAME,
    async (_event, id: string, displayName: string) => {
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
    }
  );

  /**
   * ワークスペースアイテムを更新（全フィールド対応）
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_UPDATE_ITEM,
    async (_event, id: string, updates: Partial<WorkspaceItem>) => {
      try {
        const workspaceService = await WorkspaceService.getInstance();
        await workspaceService.updateItem(id, updates);
        logger.info({ id, updates }, 'Updated workspace item');
        notifyWorkspaceChanged();
        return { success: true };
      } catch (error) {
        logger.error({ error, id }, 'Failed to update workspace item');
        throw error;
      }
    }
  );

  /**
   * ワークスペースアイテムの並び順を変更
   */
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REORDER_ITEMS, async (_event, itemIds: string[]) => {
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
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LAUNCH_ITEM, async (_event, item: WorkspaceItem) => {
    try {
      // windowOperationタイプの場合
      if (item.type === 'windowOperation') {
        const match = item.path.match(/^\[ウィンドウ操作: (.+)\]$/);
        const windowTitle = match ? match[1] : item.path;

        const activationResult = await tryActivateWindow(
          {
            title: windowTitle,
            processName: item.processName,
            x: item.windowX,
            y: item.windowY,
            width: item.windowWidth,
            height: item.windowHeight,
            virtualDesktopNumber: item.virtualDesktopNumber,
            activateWindow: item.activateWindow,
            moveToActiveMonitorCenter: item.moveToActiveMonitorCenter,
            pinToAllDesktops: item.pinToAllDesktops,
          },
          item.displayName,
          logger
        );

        if (activationResult.activated) {
          logger.info({ id: item.id, name: item.displayName }, 'Window operation executed');
          return { success: true };
        }
        logger.warn(
          { id: item.id, name: item.displayName, windowTitle },
          'Window operation failed: Window not found'
        );
        throw new Error(`ウィンドウが見つかりませんでした: ${windowTitle}`);
      }

      // groupタイプの場合：グループ内のアイテムを順次実行
      if (item.type === 'group') {
        logger.info(
          { groupName: item.displayName, itemNames: item.itemNames },
          'Group item launch requested'
        );

        if (!item.itemNames || item.itemNames.length === 0) {
          logger.warn({ groupName: item.displayName }, 'Group has no items to execute');
          return { success: true, message: 'グループにアイテムが登録されていません' };
        }

        const configFolder = PathManager.getConfigFolder();
        const allItems = await loadDataFiles(configFolder);

        logger.info(
          { groupName: item.displayName, itemCount: item.itemNames.length },
          'Executing group from workspace'
        );

        let successCount = 0;
        let errorCount = 0;

        // アイテム名からLauncherItemまたはWindowItemを検索するマップを作成
        const itemMap = new Map<string, AppItem>();
        for (const appItem of allItems) {
          if (isLauncherItem(appItem) || isWindowItem(appItem)) {
            itemMap.set(appItem.displayName, appItem);
          }
        }

        // グループ内のアイテムを順次実行
        for (const itemName of item.itemNames) {
          const targetItem = itemMap.get(itemName);

          if (!targetItem) {
            logger.warn(
              { groupName: item.displayName, itemName },
              'Group item not found in launcher items'
            );
            errorCount++;
            continue;
          }

          try {
            if (isWindowItem(targetItem)) {
              await tryActivateWindow(
                {
                  title: targetItem.windowTitle,
                  processName: targetItem.processName,
                  x: targetItem.x,
                  y: targetItem.y,
                  width: targetItem.width,
                  height: targetItem.height,
                  moveToActiveMonitorCenter: targetItem.moveToActiveMonitorCenter,
                  virtualDesktopNumber: targetItem.virtualDesktopNumber,
                  activateWindow: targetItem.activateWindow,
                  pinToAllDesktops: targetItem.pinToAllDesktops,
                },
                targetItem.displayName,
                logger
              );
            } else if (isLauncherItem(targetItem)) {
              // 通常のLauncherItemの場合
              await launchItem(
                {
                  type: targetItem.type,
                  path: targetItem.path,
                  args: targetItem.args,
                  displayName: targetItem.displayName,
                },
                logger
              );
            }
            successCount++;
          } catch (error) {
            logger.error(
              { groupName: item.displayName, itemName, error },
              'Failed to execute group item'
            );
            errorCount++;
          }
        }

        logger.info(
          { groupName: item.displayName, successCount, errorCount },
          'Group execution completed'
        );
        return { success: true, successCount, errorCount };
      }

      // クリップボードタイプの場合
      if (item.type === 'clipboard') {
        if (!item.clipboardDataRef) {
          logger.warn({ id: item.id, name: item.displayName }, 'Clipboard data ref not found');
          throw new Error('クリップボードデータの参照が見つかりません');
        }

        await launchItem(
          {
            type: 'clipboard',
            path: '',
            displayName: item.displayName,
            clipboardDataRef: item.clipboardDataRef,
          },
          logger
        );

        logger.info(
          { id: item.id, name: item.displayName },
          'Restored clipboard from workspace item'
        );
        return { success: true };
      }

      // ウィンドウ設定が存在する場合、先にウィンドウ検索を試行
      const activationResult = await tryActivateWindow(item.windowConfig, item.displayName, logger);

      if (activationResult.activated) {
        // ウィンドウアクティブ化成功
        return { success: true };
      }
      // アクティブ化失敗または未設定の場合は下記の通常起動処理へフォールバック

      // WorkspaceItemを起動：共通のlaunchItem関数を使用
      // この時点でwindowOperationとgroupは処理済みなので、LaunchableItemの型にキャスト
      await launchItem(
        {
          type: item.type as 'url' | 'file' | 'folder' | 'app' | 'customUri',
          path: item.path,
          args: item.args,
          displayName: item.displayName,
        },
        logger
      );

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
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LOAD_GROUPS, async () => {
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
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_CREATE_GROUP,
    async (_event, name: string, color?: string, parentGroupId?: string) => {
      try {
        const workspaceService = await WorkspaceService.getInstance();
        const group = await workspaceService.createGroup(name, color, parentGroupId);
        logger.info(
          { id: group.id, name: group.displayName, parentGroupId },
          'Created workspace group'
        );
        notifyWorkspaceChanged();
        return group;
      } catch (error) {
        logger.error({ error, name }, 'Failed to create workspace group');
        throw error;
      }
    }
  );

  /**
   * グループを更新
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_UPDATE_GROUP,
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
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_DELETE_GROUP,
    async (_event, id: string, deleteItems: boolean) => {
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
    }
  );

  /**
   * グループの並び順を変更
   */
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REORDER_GROUPS, async (_event, groupIds: string[]) => {
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
   * サブグループとアイテムの混在並べ替え
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_REORDER_MIXED,
    async (_event, parentGroupId: string | undefined, entries: MixedOrderEntry[]) => {
      try {
        const workspaceService = await WorkspaceService.getInstance();
        await workspaceService.reorderMixed(parentGroupId, entries);
        logger.info({ parentGroupId, count: entries.length }, 'Reordered mixed children');
        notifyWorkspaceChanged();
        return { success: true };
      } catch (error) {
        logger.error({ error }, 'Failed to reorder mixed children');
        throw error;
      }
    }
  );

  /**
   * 複数グループのcollapsed状態を一括更新
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SET_GROUPS_COLLAPSED,
    async (_event, ids: string[], collapsed: boolean) => {
      try {
        const workspaceService = await WorkspaceService.getInstance();
        await workspaceService.setGroupsCollapsed(ids, collapsed);
        logger.info({ count: ids.length, collapsed }, 'Batch updated groups collapsed state');
        notifyWorkspaceChanged();
        return { success: true };
      } catch (error) {
        logger.error({ error, ids, collapsed }, 'Failed to batch update groups collapsed state');
        throw error;
      }
    }
  );

  /**
   * アイテムをグループに移動
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_MOVE_ITEM_TO_GROUP,
    async (_event, itemId: string, groupId?: string) => {
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
    }
  );

  /**
   * グループを別の親グループに移動
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_MOVE_GROUP_TO_PARENT,
    async (_event, groupId: string, newParentGroupId?: string) => {
      try {
        const workspaceService = await WorkspaceService.getInstance();
        await workspaceService.moveGroupToParent(groupId, newParentGroupId);
        logger.info({ groupId, newParentGroupId }, 'Moved group to new parent');
        notifyWorkspaceChanged();
        return { success: true };
      } catch (error) {
        logger.error({ error, groupId, newParentGroupId }, 'Failed to move group to parent');
        throw error;
      }
    }
  );

  // ==================== アーカイブ管理ハンドラー ====================

  /**
   * グループとそのアイテムをアーカイブ
   */
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_ARCHIVE_GROUP, async (_event, groupId: string) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.archiveGroup(groupId);
      logger.info({ groupId }, 'Archived workspace group');
      notifyWorkspaceChanged();
      return { success: true };
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to archive workspace group');
      throw error;
    }
  });

  /**
   * アーカイブされたグループ一覧を取得
   */
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LOAD_ARCHIVED_GROUPS, async () => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      const archivedGroups = await workspaceService.loadArchivedGroups();
      logger.info({ count: archivedGroups.length }, 'Loaded archived groups');
      return archivedGroups;
    } catch (error) {
      logger.error({ error }, 'Failed to load archived groups');
      throw error;
    }
  });

  /**
   * アーカイブされたグループを復元
   */
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_RESTORE_GROUP, async (_event, groupId: string) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.restoreGroup(groupId);
      logger.info({ groupId }, 'Restored workspace group from archive');
      notifyWorkspaceChanged();
      return { success: true };
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to restore workspace group');
      throw error;
    }
  });

  /**
   * アーカイブされたグループを完全削除
   */
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE_ARCHIVED_GROUP, async (_event, groupId: string) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.deleteArchivedGroup(groupId);
      logger.info({ groupId }, 'Deleted archived workspace group permanently');
      notifyWorkspaceChanged();
      return { success: true };
    } catch (error) {
      logger.error({ error, groupId }, 'Failed to delete archived workspace group');
      throw error;
    }
  });

  logger.info('Workspace IPC handlers registered');
}
