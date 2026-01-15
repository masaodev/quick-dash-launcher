import { ipcMain, BrowserWindow } from 'electron';
import logger from '@common/logger';
import type { AppItem, WorkspaceItem, WorkspaceGroup, WindowConfig } from '@common/types';
import { isWindowInfo, isLauncherItem, isWindowOperationItem } from '@common/utils/typeGuards';
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
  WORKSPACE_LOAD_EXECUTION_HISTORY,
  WORKSPACE_ADD_EXECUTION_HISTORY,
  WORKSPACE_CLEAR_EXECUTION_HISTORY,
  WORKSPACE_ARCHIVE_GROUP,
  WORKSPACE_LOAD_ARCHIVED_GROUPS,
  WORKSPACE_RESTORE_GROUP,
  WORKSPACE_DELETE_ARCHIVED_GROUP,
  WORKSPACE_CHANGED,
} from '@common/ipcChannels';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import { tryActivateWindow } from '../utils/windowActivator.js';
import { launchItem } from '../utils/itemLauncher.js';
import { WorkspaceService } from '../services/workspace/index.js';
import PathManager from '../config/pathManager.js';
import { IconService } from '../services/iconService.js';

import { loadDataFiles } from './dataHandlers.js';

/**
 * ワークスペース変更イベントを全てのウィンドウに送信
 */
export function notifyWorkspaceChanged(): void {
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
  ipcMain.handle(WORKSPACE_ADD_ITEM, async (_event, item: AppItem, groupId?: string) => {
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
  });

  /**
   * ファイルパスからワークスペースにアイテムを追加
   * アイテムタイプに応じてアイコンを自動取得する
   */
  ipcMain.handle(
    WORKSPACE_ADD_ITEMS_FROM_PATHS,
    async (_event, filePaths: string[], groupId?: string) => {
      try {
        const workspaceService = await WorkspaceService.getInstance();
        const addedItems: WorkspaceItem[] = [];

        // アイコンキャッシュフォルダのパスを取得
        const iconsFolder = PathManager.getIconsFolder();
        const extensionsFolder = PathManager.getExtensionsFolder();

        for (const filePath of filePaths) {
          try {
            // アイテムタイプを判定
            const itemType = detectItemTypeSync(filePath);

            // タイプに応じてアイコンを取得（IconServiceを使用）
            const icon = await IconService.getIconForItem(
              filePath,
              itemType,
              iconsFolder,
              extensionsFolder
            );
            logger.info(
              { path: filePath, hasIcon: !!icon, type: itemType },
              'Extracted icon for workspace'
            );

            // アイコン付きでアイテムを追加
            const addedItem = await workspaceService.addItemFromPath(filePath, icon, groupId);
            addedItems.push(addedItem);
            logger.info(
              { id: addedItem.id, name: addedItem.displayName, path: filePath, type: itemType },
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
    }
  );

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
      // windowOperationタイプの場合
      if (item.type === 'windowOperation') {
        // pathから windowTitle を抽出（[ウィンドウ操作: タイトル] 形式）
        const match = item.path.match(/^\[ウィンドウ操作: (.+)\]$/);
        const windowTitle = match ? match[1] : item.path;

        // WindowConfigを構築
        const windowConfig = {
          title: windowTitle,
          processName: item.processName,
          x: item.windowX,
          y: item.windowY,
          width: item.windowWidth,
          height: item.windowHeight,
          virtualDesktopNumber: item.virtualDesktopNumber,
          activateWindow: item.activateWindow,
          moveToActiveMonitorCenter: item.moveToActiveMonitorCenter,
        };

        // ウィンドウ操作を実行
        const activationResult = await tryActivateWindow(
          windowConfig,
          undefined,
          item.displayName,
          logger
        );

        if (activationResult.activated) {
          logger.info({ id: item.id, name: item.displayName }, 'Window operation executed');
          return { success: true };
        } else {
          logger.warn(
            { id: item.id, name: item.displayName, windowTitle },
            'Window operation failed: Window not found'
          );
          throw new Error(`ウィンドウが見つかりませんでした: ${windowTitle}`);
        }
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

        // アイテム名からLauncherItemまたはWindowOperationItemを検索するマップを作成
        const itemMap = new Map<string, AppItem>();
        for (const appItem of allItems) {
          if (isLauncherItem(appItem)) {
            itemMap.set(appItem.name, appItem);
          } else if (isWindowOperationItem(appItem)) {
            itemMap.set(appItem.name, appItem);
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
            if (isWindowOperationItem(targetItem)) {
              // ウィンドウ操作アイテムの場合
              const windowConfig: WindowConfig = {
                title: targetItem.windowTitle,
                processName: targetItem.processName,
                x: targetItem.x,
                y: targetItem.y,
                width: targetItem.width,
                height: targetItem.height,
                virtualDesktopNumber: targetItem.virtualDesktopNumber,
                activateWindow: targetItem.activateWindow,
              };

              await tryActivateWindow(windowConfig, undefined, targetItem.name, logger);
            } else if (isLauncherItem(targetItem)) {
              // 通常のLauncherItemの場合
              await launchItem(
                {
                  type: targetItem.type,
                  path: targetItem.path,
                  args: targetItem.args,
                  name: targetItem.name,
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

      // ウィンドウ設定が存在する場合、先にウィンドウ検索を試行
      const activationResult = await tryActivateWindow(
        item.windowConfig,
        undefined,
        item.displayName,
        logger
      );

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
          name: item.displayName,
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

  // ==================== 実行履歴ハンドラー ====================

  /**
   * 実行履歴を全て取得
   */
  ipcMain.handle(WORKSPACE_LOAD_EXECUTION_HISTORY, async () => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      const history = await workspaceService.loadExecutionHistory();
      logger.info({ count: history.length }, 'Loaded execution history');
      return history;
    } catch (error) {
      logger.error({ error }, 'Failed to load execution history');
      throw error;
    }
  });

  /**
   * アイテム実行を履歴に追加
   */
  ipcMain.handle(WORKSPACE_ADD_EXECUTION_HISTORY, async (_event, item: AppItem) => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.addExecutionHistory(item);
      const itemName = isWindowInfo(item) ? item.title : item.name;
      logger.info({ itemName }, 'Added item to execution history');
      notifyWorkspaceChanged();
      return { success: true };
    } catch (error) {
      const itemName = isWindowInfo(item) ? item.title : item.name;
      logger.error({ error, itemName }, 'Failed to add execution history');
      // エラーでも処理は継続
      return { success: false };
    }
  });

  /**
   * 実行履歴をクリア
   */
  ipcMain.handle(WORKSPACE_CLEAR_EXECUTION_HISTORY, async () => {
    try {
      const workspaceService = await WorkspaceService.getInstance();
      await workspaceService.clearExecutionHistory();
      logger.info('Cleared execution history');
      notifyWorkspaceChanged();
      return { success: true };
    } catch (error) {
      logger.error({ error }, 'Failed to clear execution history');
      throw error;
    }
  });

  // ==================== アーカイブ管理ハンドラー ====================

  /**
   * グループとそのアイテムをアーカイブ
   */
  ipcMain.handle(WORKSPACE_ARCHIVE_GROUP, async (_event, groupId: string) => {
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
  ipcMain.handle(WORKSPACE_LOAD_ARCHIVED_GROUPS, async () => {
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
  ipcMain.handle(WORKSPACE_RESTORE_GROUP, async (_event, groupId: string) => {
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
  ipcMain.handle(WORKSPACE_DELETE_ARCHIVED_GROUP, async (_event, groupId: string) => {
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
