import * as path from 'path';

import { ipcMain } from 'electron';
import logger from '@common/logger';
import type {
  AppItem,
  WorkspaceItem,
  WorkspaceItemUpdate,
  WorkspaceGroupUpdate,
  MixedOrderEntry,
} from '@common/types';
import { IPC_CHANNELS } from '@common/ipcChannels';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { getDescendantGroupIds } from '@common/utils/groupTreeUtils';
import { pickItemWindowSwitch } from '@common/utils/itemWindowConversion';
import type { LaunchOptions } from '@common/types/launchUsage';

import { launchItem } from '../utils/itemLauncher.js';
import {
  WorkspaceService,
  WorkspaceCorruptedError,
  WorkspaceExternalChangeConflictError,
  WorkspaceReloadInProgressError,
  WorkspaceWriteError,
} from '../services/workspace/index.js';
import { LONG_TOAST_DURATION_MS, showToastWindow } from '../services/overlayWindowService.js';
import PathManager from '../config/pathManager.js';
import { getIconForItem } from '../services/iconService.js';
import { withFolderMarker } from '../utils/folderPathProbe.js';
import { closeDetachedGroupWindow } from '../detachedGroupWindowManager.js';
import { reloadConfigFiles } from '../services/data/dataFileLoader.js';
import { mainI18n } from '../services/mainI18n.js';
import {
  executeSet,
  indexItemsById,
  isSetRunning,
  notifySetFailures,
  resolveSetEntry,
} from '../services/launch/setExecutor.js';
import { notifyLaunchFailure, openSingleItem } from '../services/launch/itemOpener.js';
import { LaunchUsageService } from '../services/launchUsageService.js';
import { ClipboardService } from '../services/clipboardService.js';
import {
  addAppItemToWorkspace,
  applyLinkCopies,
  convertRefToCopy,
  ensureMainItemIndex,
  findLinkCandidates,
  linkToMainItem,
  previewLinkCopies,
} from '../services/workspace/workspaceRefOperations.js';

import { notifyWorkspaceChanged } from './notifications.js';
import { moveItemToMain } from './workspaceRefMenu.js';

/**
 * 指定グループとその子孫の切り離しウィンドウをすべて閉じる
 */
export async function closeDetachedWindowsForGroup(groupId: string): Promise<void> {
  const workspaceService = await WorkspaceService.getInstance();
  const groups = await workspaceService.loadGroups();
  const descendantIds = getDescendantGroupIds(groupId, groups);
  for (const id of [groupId, ...descendantIds]) {
    closeDetachedGroupWindow(id);
  }
}

/**
 * セットの行が指すワークスペースのアイテムを、実行に使う形にする（開けるのは通常アイテムだけ）
 */
function workspaceItemToLaunchable(item: WorkspaceItem): AppItem | undefined {
  if (item.type === 'item') {
    return {
      type: item.launcherType,
      displayName: item.displayName,
      path: item.path,
      args: item.args,
      ...(item.runAsAdmin === true && { runAsAdmin: true }),
      ...pickItemWindowSwitch(item),
      id: item.id,
    };
  }
  return undefined;
}

/**
 * WorkspaceServiceの操作を実行し、エラーログとリスローを行う共通ヘルパー
 *
 * 外部編集との競合・破損・書き込み失敗は、読み込みでも書き換えでも警告のトーストで知らせる。
 * notifyFailure が true（書き換え）なら、それ以外の失敗もエラーのトーストで知らせる
 * （画面側はログに残すだけなので、知らせないと何も起きなかったように見える）
 */
async function withWorkspaceService<T>(
  action: (service: WorkspaceService) => Promise<T>,
  errorMsg: string,
  errorContext?: Record<string, unknown>,
  notifyFailure = false
): Promise<T> {
  try {
    const workspaceService = await WorkspaceService.getInstance();
    return await action(workspaceService);
  } catch (error) {
    logger.error({ error, ...errorContext }, errorMsg);
    // 外部編集との競合・破損・書き込み失敗は操作者に直接伝える
    if (
      error instanceof WorkspaceExternalChangeConflictError ||
      error instanceof WorkspaceCorruptedError ||
      error instanceof WorkspaceReloadInProgressError ||
      error instanceof WorkspaceWriteError
    ) {
      showToastWindow({
        message: error.message,
        type: 'warning',
        duration: LONG_TOAST_DURATION_MS,
      }).catch(() => {});
    } else if (notifyFailure) {
      showToastWindow({
        message: mainI18n.t('workspaceErrors.changeFailed', {
          error: error instanceof Error ? error.message : String(error),
        }),
        type: 'error',
        duration: LONG_TOAST_DURATION_MS,
      }).catch(() => {});
    }
    throw error;
  }
}

/**
 * WorkspaceServiceの変更操作を実行し、成功時にnotifyWorkspaceChangedを呼び出す
 *
 * 失敗はトーストで知らせる。折りたたみのような表示の状態だけを保存する操作は notifyFailure を false にする
 */
async function withWorkspaceChange<T = void>(
  action: (service: WorkspaceService) => Promise<T>,
  logMsg: string,
  errorMsg: string,
  logContext?: Record<string, unknown>,
  errorContext?: Record<string, unknown>,
  notifyFailure = true
): Promise<{ success: true } & Record<string, unknown>> {
  const result = await withWorkspaceService(
    async (service) => {
      const actionResult = await action(service);
      logger.info(logContext ?? {}, logMsg);
      notifyWorkspaceChanged();
      return actionResult;
    },
    errorMsg,
    errorContext,
    notifyFailure
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
      // 参照はメインウィンドウのアイテムの中身で埋めて渡す（まだデータファイルを読んでいなければ読む）
      await ensureMainItemIndex();
      const items = await service.loadResolvedItems();
      logger.info({ count: items.length }, 'Loaded workspace items');
      return items;
    }, 'Failed to load workspace items')
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_ADD_ITEM,
    (
      _event,
      item: AppItem,
      groupId?: string,
      workspaceId?: string,
      options?: { copy?: boolean; freshClipboardData?: boolean }
    ) =>
      withWorkspaceService(
        async () => {
          // 既定はメインウィンドウのアイテムの参照。参照できないもの・copy の指定はコピー（クリップボードは実データを複製）
          const result = await addAppItemToWorkspace(item, groupId, workspaceId, options);
          logger.info(
            {
              id: result.item.id,
              name: result.item.displayName,
              groupId,
              workspaceId,
              linked: result.linked,
            },
            'Added item to workspace'
          );
          notifyWorkspaceChanged();
          if (result.fellBackToCopy) {
            showToastWindow({
              message: mainI18n.t('workspace.ref.addedAsCopy'),
              type: 'info',
            }).catch(() => {});
          }
          return result.item;
        },
        'Failed to add item to workspace',
        undefined,
        true
      )
  );

  // 編集フォームで新しく入力したもの（グループの右クリック「新しく入力して追加」）。クリップボードの中身は
  // 入力したときに作った実データのファイルをそのまま持たせる（ほかのアイテムと共有しないので複製しない）
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_CREATE_ITEM,
    (_event, body: WorkspaceItemUpdate, groupId?: string, workspaceId?: string) =>
      withWorkspaceService(
        async (service) => {
          const created = await service.createItem(body, groupId, workspaceId);
          logger.info(
            { id: created.id, name: created.displayName, groupId, workspaceId },
            'Created workspace item'
          );
          notifyWorkspaceChanged();
          return created;
        },
        'Failed to create workspace item',
        undefined,
        true
      )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_ADD_ITEMS_FROM_PATHS,
    (_event, filePaths: string[], groupId?: string, workspaceId?: string) =>
      withWorkspaceService(
        async (service) => {
          const addedItems: WorkspaceItem[] = [];
          const failed: { name: string; error: string }[] = [];
          // グループの無いワークスペースでは、ループの前に「未分類」グループを 1 つだけ作り、全部そこへ入れる
          // （1 件ずつ決めると 2 件目から WorkspaceGroupRequiredError になる。1 件目が失敗しても同じ）。
          // グループのあるワークスペースで指定が無いときは、1 件ずつ同じエラーで知らせる
          let targetGroupId = groupId;
          if (targetGroupId === undefined && filePaths.length > 0) {
            try {
              targetGroupId = (await service.resolveAddPlacement(undefined, workspaceId)).groupId;
            } catch {
              // 下の 1 件ずつの追加で失敗として返す
            }
          }

          for (const filePath of filePaths) {
            try {
              // ドット入りのフォルダ名は末尾に区切り文字を付けてから判定する（拡張子のアイコンを取りに行かない）
              const markedPath = await withFolderMarker(filePath);
              const itemType = detectItemTypeSync(markedPath);
              await getIconForItem(markedPath, itemType);
              const addedItem = await service.addItemFromPath(
                markedPath,
                targetGroupId,
                workspaceId
              );
              addedItems.push(addedItem);
              logger.info(
                { id: addedItem.id, name: addedItem.displayName, path: filePath, type: itemType },
                'Added item from path to workspace'
              );
            } catch (error) {
              logger.error({ error, path: filePath }, 'Failed to add item from path');
              failed.push({
                name: path.basename(filePath) || filePath,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          if (addedItems.length > 0) {
            notifyWorkspaceChanged();
          }
          // 足せたものだけ返す。足せなかったものはここで知らせる（画面側は返ったものだけ「追加しました」と出す）
          if (failed.length > 0) {
            showToastWindow({
              message: mainI18n.t('workspaceErrors.addFromPathsFailed', {
                count: failed.length,
                names: failed.map((f) => f.name).join(mainI18n.t('common.listSeparator')),
                error: failed[0].error,
              }),
              type: 'error',
              duration: LONG_TOAST_DURATION_MS,
            }).catch(() => {});
          }

          return addedItems;
        },
        'Failed to add items from paths to workspace',
        undefined,
        true
      )
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
        // 参照でメインの表示名と同じ名前にしたかを見るので、メインのアイテムの表を先に用意する
        async (service) => {
          await ensureMainItemIndex();
          await service.updateDisplayName(id, displayName);
        },
        'Updated workspace item display name',
        'Failed to update workspace item display name',
        { id, displayName },
        { id }
      )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_UPDATE_ITEM,
    (_event, id: string, updates: WorkspaceItemUpdate) =>
      withWorkspaceChange(
        (service) => service.updateItem(id, updates),
        'Updated workspace item',
        'Failed to update workspace item',
        { id, updates },
        { id }
      )
  );

  /**
   * ワークスペースアイテムを起動
   */
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_LAUNCH_ITEM,
    async (_event, requested: WorkspaceItem, options?: LaunchOptions) => {
      let item = requested;
      try {
        // 参照はメインウィンドウのアイテムの今の中身で開く（画面が持っている中身は古いことがある）
        if (requested.ref) {
          await ensureMainItemIndex();
          const workspaceService = await WorkspaceService.getInstance();
          item = (await workspaceService.findResolvedItem(requested.id)) ?? requested;
        }
        if (item.type === 'ref') {
          const reason =
            item.ref.status === 'unsupported'
              ? mainI18n.t('workspace.ref.unsupported')
              : mainI18n.t('workspace.ref.missing');
          logger.warn({ id: item.id, refItemId: item.ref.itemId }, 'Reference item not resolved');
          await showToastWindow({
            message: mainI18n.t('workspace.ref.launchMissing', { name: item.displayName, reason }),
            type: 'warning',
          });
          return { success: false };
        }

        // クリップボードタイプの場合
        if (item.type === 'clipboard') {
          if (!item.dataFileRef) {
            logger.warn({ id: item.id, name: item.displayName }, 'Clipboard data ref not found');
            throw new Error(mainI18n.t('launcher.messages.clipboardDataMissing'));
          }

          // 成功のトーストは画面側が結果を見て出す（書き戻す前に出すと、終わっていないように見える）
          const restored = await launchItem(
            {
              type: 'clipboard',
              path: '',
              displayName: item.displayName,
              clipboardDataRef: item.dataFileRef,
            },
            logger
          );
          if (!restored.success) {
            await notifyLaunchFailure(item.displayName, restored);
            return { success: false };
          }

          if (item.ref && !options?.trial) {
            await LaunchUsageService.getInstance()?.recordById(item.ref.itemId);
          }
          logger.info(
            { id: item.id, name: item.displayName },
            'Restored clipboard from workspace item'
          );
          return { success: true };
        }

        // セット: 行はワークスペースのアイテムを先に、データファイルのアイテムを後に探す
        if (item.type === 'set') {
          const workspaceService = await WorkspaceService.getInstance();
          const configFolder = PathManager.getConfigFolder();
          const allItems = await reloadConfigFiles(configFolder, 'internal');
          const workspaceItems = await workspaceService.loadResolvedItems();
          const byId = indexItemsById(allItems);
          for (const wsItem of workspaceItems) {
            const converted = workspaceItemToLaunchable(wsItem);
            if (converted) byId.set(wsItem.id, converted);
          }
          const resolve = (itemId: string) => byId.get(itemId);
          // 行の名前はデータファイルのアイテムからも引くので、ワークスペースの画面ではなくここで知らせる
          // （実行中に押し直したときは何もしないので知らせない）
          if (!isSetRunning(item.id))
            await showToastWindow({
              displayName: item.displayName,
              itemType: 'set',
              itemCount: item.entries.length,
              itemNames: item.entries
                .map((entry) => resolveSetEntry(entry, resolve).name)
                .filter((name) => name !== '')
                .slice(0, 3),
            });
          const result = await executeSet(item, resolve);
          await notifySetFailures(item, result);
          if (item.ref && !options?.trial) {
            await LaunchUsageService.getInstance()?.recordById(item.ref.itemId);
          }
          logger.info(
            { id: item.id, name: item.displayName, ...result, entries: undefined },
            'Executed set from workspace item'
          );
          return {
            success: true,
            successCount: result.successCount,
            errorCount: result.errorCount,
          };
        }

        // 単一アイテムはメイン画面と同じ処理で開く（起動種別は path から判定済み）
        if (!(await openSingleItem({ ...item, type: item.launcherType }, logger))) {
          return { success: false };
        }
        // 参照はメインウィンドウのアイテムの id で数える。コピーは id が違うので、パスでメインのアイテムに寄せる
        //（編集画面で試しに開いたときは数えない）
        if (!options?.trial) {
          const usage = LaunchUsageService.getInstance();
          if (item.ref) await usage?.recordById(item.ref.itemId);
          else await usage?.recordByPath(item.path);
        }

        logger.info(
          { id: item.id, name: item.displayName, path: item.path },
          'Launched workspace item'
        );
        return { success: true };
      } catch (error) {
        logger.error(
          { error, id: item.id, type: item.type, name: item.displayName },
          'Failed to launch workspace item'
        );
        // 画面側はログに残すだけなので、ここで知らせる
        await notifyLaunchFailure(item.displayName, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  );

  // ==================== 参照アイテム ====================

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CONVERT_TO_COPY, (_event, id: string) =>
    withWorkspaceChange(
      async () => ({ item: await convertRefToCopy(id) }),
      'Converted reference item to copy',
      'Failed to convert reference item to copy',
      { id },
      { id }
    )
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LINK_TO_MAIN, (_event, id: string, mainItemId: string) =>
    withWorkspaceChange(
      async () => ({ item: await linkToMainItem(id, mainItemId) }),
      'Linked workspace item to launcher item',
      'Failed to link workspace item',
      { id, mainItemId },
      { id, mainItemId }
    )
  );

  // メインウィンドウへのドロップ。結果は右クリックと同じくトーストで知らせる（ワークスペースの画面へもここで知らせる）
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_MOVE_TO_MAIN, (_event, id: string, file?: string) =>
    moveItemToMain(id, file)
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_FIND_LINK_CANDIDATES, (_event, id: string) =>
    withWorkspaceService(() => findLinkCandidates(id), 'Failed to find link candidates', { id })
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_PREVIEW_LINK_COPIES, (_event, workspaceId: string) =>
    withWorkspaceService(() => previewLinkCopies(workspaceId), 'Failed to preview linking copies', {
      workspaceId,
    })
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_APPLY_LINK_COPIES,
    (_event, ids: string[], choices?: Record<string, string>) =>
      withWorkspaceChange(
        async () => ({ count: await applyLinkCopies(ids, choices) }),
        'Linked workspace copies to launcher items',
        'Failed to link workspace copies',
        { count: ids.length }
      )
  );

  // メインウィンドウのアイテムを指すワークスペースの参照の数（削除の確認・編集画面の帯に出す）
  ipcMain.handle(IPC_CHANNELS.WORKSPACE_COUNT_REFS, (_event, itemIds: string[]) =>
    withWorkspaceService((service) => service.countRefs(itemIds), 'Failed to count references')
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REMAP_REFS, (_event, idMap: Record<string, string>) =>
    withWorkspaceChange(
      async (service) => ({ count: await service.remapRefs(new Map(Object.entries(idMap))) }),
      'Remapped workspace references',
      'Failed to remap workspace references',
      { count: Object.keys(idMap).length }
    )
  );

  // ==================== ワークスペース（タブ）管理ハンドラー ====================

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LOAD_WORKSPACES, () =>
    withWorkspaceService(async (service) => {
      const workspaces = await service.loadWorkspaces();
      logger.info({ count: workspaces.length }, 'Loaded workspaces');
      return workspaces;
    }, 'Failed to load workspaces')
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_CREATE_WORKSPACE, (_event, name: string) =>
    withWorkspaceService(
      async (service) => {
        const workspace = await service.createWorkspace(name);
        notifyWorkspaceChanged();
        return workspace;
      },
      'Failed to create workspace',
      undefined,
      true
    )
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_RENAME_WORKSPACE, (_event, id: string, name: string) =>
    withWorkspaceChange(
      (service) => service.renameWorkspace(id, name),
      'Renamed workspace',
      'Failed to rename workspace',
      { id, name },
      { id }
    )
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE_WORKSPACE, (_event, id: string) =>
    withWorkspaceChange(
      async (service) => {
        // 削除前に所属グループの切り離しウィンドウを閉じる（サブグループも所属に含まれるので、子孫は辿らない）
        const groups = await service.loadGroups();
        for (const group of groups) {
          if (group.workspaceId === id) closeDetachedGroupWindow(group.id);
        }
        await service.deleteWorkspace(id);
      },
      'Deleted workspace',
      'Failed to delete workspace',
      { id }
    )
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_REORDER_WORKSPACES, (_event, ids: string[]) =>
    withWorkspaceChange(
      (service) => service.reorderWorkspaces(ids),
      'Reordered workspaces',
      'Failed to reorder workspaces',
      { count: ids.length }
    )
  );

  // ==================== グループ管理ハンドラー ====================

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LOAD_GROUPS, () =>
    withWorkspaceService(async (service) => {
      const groups = await service.loadGroups();
      logger.info({ count: groups.length }, 'Loaded workspace groups');
      return groups;
    }, 'Failed to load workspace groups')
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DUPLICATE_GROUP, (_event, groupId: string, name: string) =>
    withWorkspaceService(
      async (service) => {
        const group = await service.duplicateGroup(groupId, name, (ref) =>
          ClipboardService.getInstance().duplicateClipboardData(ref)
        );
        notifyWorkspaceChanged();
        return group;
      },
      'Failed to duplicate workspace group',
      { groupId },
      true
    )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_CREATE_GROUP,
    (_event, name: string, color?: string, parentGroupId?: string, workspaceId?: string) =>
      withWorkspaceService(
        async (service) => {
          const group = await service.createGroup(name, color, parentGroupId, workspaceId);
          logger.info(
            { id: group.id, name: group.displayName, parentGroupId, workspaceId },
            'Created workspace group'
          );
          notifyWorkspaceChanged();
          return group;
        },
        'Failed to create workspace group',
        { name },
        true
      )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_UPDATE_GROUP,
    (_event, id: string, updates: WorkspaceGroupUpdate) =>
      withWorkspaceChange(
        (service) => service.updateGroup(id, updates),
        'Updated workspace group',
        'Failed to update workspace group',
        { id, updates },
        { id }
      )
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE_GROUP, (_event, id: string) =>
    withWorkspaceChange(
      async (service) => {
        await closeDetachedWindowsForGroup(id);
        await service.deleteGroup(id);
      },
      'Deleted workspace group',
      'Failed to delete workspace group',
      { id },
      { id }
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
        { ids, collapsed },
        false
      )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_DUPLICATE_ITEM,
    (_event, sourceItemId: string, targetGroupId?: string, insertOrder?: number) =>
      withWorkspaceChange(
        (service) =>
          service.duplicateItem(sourceItemId, targetGroupId, insertOrder, (ref) =>
            ClipboardService.getInstance().duplicateClipboardData(ref)
          ),
        'Duplicated workspace item',
        'Failed to duplicate workspace item',
        { sourceItemId, targetGroupId, insertOrder },
        { sourceItemId, targetGroupId }
      )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_MOVE_ITEM_TO_GROUP,
    (_event, itemId: string, groupId: string) =>
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

  // ==================== ワークスペース間移動ハンドラー ====================

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_MOVE_ITEM_TO_WORKSPACE,
    (_event, itemId: string, targetWorkspaceId: string, groupId?: string) =>
      withWorkspaceChange(
        (service) => service.moveItemToWorkspace(itemId, targetWorkspaceId, groupId),
        'Moved item to workspace',
        'Failed to move item to workspace',
        { itemId, targetWorkspaceId, groupId },
        { itemId, targetWorkspaceId, groupId }
      )
  );

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_MOVE_GROUP_TO_WORKSPACE,
    (_event, groupId: string, targetWorkspaceId: string) =>
      withWorkspaceChange(
        (service) => service.moveGroupToWorkspace(groupId, targetWorkspaceId),
        'Moved group to workspace',
        'Failed to move group to workspace',
        { groupId, targetWorkspaceId },
        { groupId, targetWorkspaceId }
      )
  );

  // ==================== アーカイブ管理ハンドラー ====================

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_ARCHIVE_GROUP, (_event, groupId: string) =>
    withWorkspaceChange(
      async (service) => {
        await closeDetachedWindowsForGroup(groupId);
        await service.archiveGroup(groupId);
      },
      'Archived workspace group',
      'Failed to archive workspace group',
      { groupId },
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

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_LOAD_ARCHIVED_ITEMS, () =>
    withWorkspaceService(async (service) => {
      await ensureMainItemIndex();
      const archivedItems = await service.loadResolvedArchivedItems();
      logger.info({ count: archivedItems.length }, 'Loaded archived items');
      return archivedItems;
    }, 'Failed to load archived items')
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

  logger.info('Workspace IPC handlers registered');
}
