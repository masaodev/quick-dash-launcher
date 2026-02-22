import { ipcMain, BrowserWindow } from 'electron';
import logger from '@common/logger';
import type { AppItem, WorkspaceItem, WorkspaceGroup, MixedOrderEntry } from '@common/types';
import { isLauncherItem, isWindowItem } from '@common/types/guards';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { getDescendantGroupIds } from '@common/utils/groupTreeUtils';

import { tryActivateWindow } from '../utils/windowActivator.js';
import { launchItem } from '../utils/itemLauncher.js';
import { WorkspaceService } from '../services/workspace/index.js';
import PathManager from '../config/pathManager.js';
import { getIconForItem } from '../services/iconService.js';
import { closeDetachedGroupWindow } from '../detachedGroupWindowManager.js';

import { loadDataFiles } from './dataHandlers.js';

/**
 * 指定グループとその子孫の切り離しウィンドウをすべて閉じる
 */
async function closeDetachedWindowsForGroup(groupId: string): Promise<void> {
  const workspaceService = await WorkspaceService.getInstance();
  const groups = await workspaceService.loadGroups();
  const descendantIds = getDescendantGroupIds(groupId, groups);
  for (const id of [groupId, ...descendantIds]) {
    closeDetachedGroupWindow(id);
  }
}

/**
 * ワークスペース変更イベントを全てのウィンドウに送信
 */
export function notifyWorkspaceChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IPC_CHANNELS.WORKSPACE_CHANGED);
  }
}

/**
 * WorkspaceServiceの操作を実行し、エラーログとリスローを行う共通ヘルパー
 */
async function withWorkspaceService<T>(
  action: (service: WorkspaceService) => Promise<T>,
  errorMsg: string,
  errorContext?: Record<string, unknown>
): Promise<T> {
  try {
    const workspaceService = await WorkspaceService.getInstance();
    return await action(workspaceService);
  } catch (error) {
    logger.error({ error, ...errorContext }, errorMsg);
    throw error;
  }
}

/**
 * WorkspaceServiceの変更操作を実行し、成功時にnotifyWorkspaceChangedを呼び出す
 */
async function withWorkspaceChange<T = void>(
  action: (service: WorkspaceService) => Promise<T>,
  logMsg: string,
  errorMsg: string,
  logContext?: Record<string, unknown>,
  errorContext?: Record<string, unknown>
): Promise<{ success: true } & Record<string, unknown>> {
  const result = await withWorkspaceService(
    async (service) => {
      const actionResult = await action(service);
      logger.info(logContext ?? {}, logMsg);
      notifyWorkspaceChanged();
      return actionResult;
    },
    errorMsg,
    errorContext
  );

  if (result && typeof result === 'object') {
    return { success: true, ...result } as { success: true } & Record<string, unknown>;
  }
  return { success: true };
}

/**
 * ワークスペース関連のIPCハンドラーを設定
 */
export function setupWorkspaceHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LOAD_ITEMS, () =>
    withWorkspaceService(async (service) => {
      const items = await service.loadItems();
      logger.info({ count: items.length }, 'Loaded workspace items');
      return items;
    }, 'Failed to load workspace items')
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_ADD_ITEM, (_event, item: AppItem, groupId?: string) =>
    withWorkspaceService(async (service) => {
      const addedItem = await service.addItem(item, groupId);
      logger.info(
        { id: addedItem.id, name: addedItem.displayName, groupId },
        'Added item to workspace'
      );
      notifyWorkspaceChanged();
      return addedItem;
    }, 'Failed to add item to workspace')
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_ADD_ITEMS_FROM_PATHS,
    (_event, filePaths: string[], groupId?: string) =>
      withWorkspaceService(async (service) => {
        const addedItems: WorkspaceItem[] = [];
        const iconsFolder = PathManager.getAppsFolder();
        const extensionsFolder = PathManager.getExtensionsFolder();

        for (const filePath of filePaths) {
          try {
            const itemType = detectItemTypeSync(filePath);
            await getIconForItem(filePath, itemType, iconsFolder, extensionsFolder);
            const addedItem = await service.addItemFromPath(filePath, groupId);
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
      }, 'Failed to add items from paths to workspace')
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REMOVE_ITEM, (_event, id: string) =>
    withWorkspaceChange(
      (service) => service.removeItem(id),
      'Removed item from workspace',
      'Failed to remove item from workspace',
      { id },
      { id }
    )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_UPDATE_DISPLAY_NAME,
    (_event, id: string, displayName: string) =>
      withWorkspaceChange(
        (service) => service.updateDisplayName(id, displayName),
        'Updated workspace item display name',
        'Failed to update workspace item display name',
        { id, displayName },
        { id }
      )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_UPDATE_ITEM,
    (_event, id: string, updates: Partial<WorkspaceItem>) =>
      withWorkspaceChange(
        (service) => service.updateItem(id, updates),
        'Updated workspace item',
        'Failed to update workspace item',
        { id, updates },
        { id }
      )
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REORDER_ITEMS, (_event, itemIds: string[]) =>
    withWorkspaceChange(
      (service) => service.reorderItems(itemIds),
      'Reordered workspace items',
      'Failed to reorder workspace items',
      { count: itemIds.length }
    )
  );

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

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LOAD_GROUPS, () =>
    withWorkspaceService(async (service) => {
      const groups = await service.loadGroups();
      logger.info({ count: groups.length }, 'Loaded workspace groups');
      return groups;
    }, 'Failed to load workspace groups')
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_CREATE_GROUP,
    (_event, name: string, color?: string, parentGroupId?: string) =>
      withWorkspaceService(
        async (service) => {
          const group = await service.createGroup(name, color, parentGroupId);
          logger.info(
            { id: group.id, name: group.displayName, parentGroupId },
            'Created workspace group'
          );
          notifyWorkspaceChanged();
          return group;
        },
        'Failed to create workspace group',
        { name }
      )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_UPDATE_GROUP,
    (_event, id: string, updates: Partial<WorkspaceGroup>) =>
      withWorkspaceChange(
        (service) => service.updateGroup(id, updates),
        'Updated workspace group',
        'Failed to update workspace group',
        { id, updates },
        { id }
      )
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE_GROUP, (_event, id: string, deleteItems: boolean) =>
    withWorkspaceService(
      async (service) => {
        await closeDetachedWindowsForGroup(id);
        await service.deleteGroup(id, deleteItems);
        logger.info({ id, deleteItems }, 'Deleted workspace group');
        notifyWorkspaceChanged();
        return { success: true };
      },
      'Failed to delete workspace group',
      { id }
    )
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REORDER_GROUPS, (_event, groupIds: string[]) =>
    withWorkspaceChange(
      (service) => service.reorderGroups(groupIds),
      'Reordered workspace groups',
      'Failed to reorder workspace groups',
      { count: groupIds.length }
    )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_REORDER_MIXED,
    (_event, parentGroupId: string | undefined, entries: MixedOrderEntry[]) =>
      withWorkspaceChange(
        (service) => service.reorderMixed(parentGroupId, entries),
        'Reordered mixed children',
        'Failed to reorder mixed children',
        { parentGroupId, count: entries.length }
      )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SET_GROUPS_COLLAPSED,
    (_event, ids: string[], collapsed: boolean) =>
      withWorkspaceChange(
        (service) => service.setGroupsCollapsed(ids, collapsed),
        'Batch updated groups collapsed state',
        'Failed to batch update groups collapsed state',
        { count: ids.length, collapsed },
        { ids, collapsed }
      )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_MOVE_ITEM_TO_GROUP,
    (_event, itemId: string, groupId?: string) =>
      withWorkspaceChange(
        (service) => service.moveItemToGroup(itemId, groupId),
        'Moved item to group',
        'Failed to move item to group',
        { itemId, groupId },
        { itemId, groupId }
      )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_MOVE_GROUP_TO_PARENT,
    (_event, groupId: string, newParentGroupId?: string) =>
      withWorkspaceChange(
        (service) => service.moveGroupToParent(groupId, newParentGroupId),
        'Moved group to new parent',
        'Failed to move group to parent',
        { groupId, newParentGroupId },
        { groupId, newParentGroupId }
      )
  );

  // ==================== アーカイブ管理ハンドラー ====================

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_ARCHIVE_GROUP, (_event, groupId: string) =>
    withWorkspaceService(
      async (service) => {
        await closeDetachedWindowsForGroup(groupId);
        await service.archiveGroup(groupId);
        logger.info({ groupId }, 'Archived workspace group');
        notifyWorkspaceChanged();
        return { success: true };
      },
      'Failed to archive workspace group',
      { groupId }
    )
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LOAD_ARCHIVED_GROUPS, () =>
    withWorkspaceService(async (service) => {
      const archivedGroups = await service.loadArchivedGroups();
      logger.info({ count: archivedGroups.length }, 'Loaded archived groups');
      return archivedGroups;
    }, 'Failed to load archived groups')
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_RESTORE_GROUP, (_event, groupId: string) =>
    withWorkspaceChange(
      (service) => service.restoreGroup(groupId),
      'Restored workspace group from archive',
      'Failed to restore workspace group',
      { groupId },
      { groupId }
    )
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE_ARCHIVED_GROUP, (_event, groupId: string) =>
    withWorkspaceChange(
      (service) => service.deleteArchivedGroup(groupId),
      'Deleted archived workspace group permanently',
      'Failed to delete archived workspace group',
      { groupId },
      { groupId }
    )
  );

  // ==================== 切り離しウィンドウ状態ハンドラー ====================

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LOAD_DETACHED_STATE, (_event, rootGroupId: string) =>
    withWorkspaceService(
      (service) => service.loadDetachedWindowState(rootGroupId),
      'Failed to load detached window state',
      { rootGroupId }
    )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SAVE_DETACHED_COLLAPSED,
    (_event, rootGroupId: string, states: Record<string, boolean>) =>
      withWorkspaceService(
        async (service) => {
          await service.saveDetachedCollapsedStates(rootGroupId, states);
          return { success: true };
        },
        'Failed to save detached collapsed states',
        { rootGroupId }
      )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SAVE_DETACHED_BOUNDS,
    (
      _event,
      rootGroupId: string,
      bounds: { x: number; y: number; width: number; height: number }
    ) =>
      withWorkspaceService(
        async (service) => {
          await service.saveDetachedBounds(rootGroupId, bounds);
          return { success: true };
        },
        'Failed to save detached bounds',
        { rootGroupId }
      )
  );

  logger.info('Workspace IPC handlers registered');
}
