import { IPC_CHANNELS } from '@common/ipcChannels';
import { JsonLauncherItem, LauncherItem } from '@common/types';
import { pickItemWindowSwitch } from '@common/utils/itemWindowConversion';
import { pickRunAsAdmin } from '@common/utils/runAsAdmin';

import {
  deleteItemsById,
  findSetNamesUsingItemIds,
  replaceItemById,
} from '../services/data/dataItemWriter.js';
import { createSafeIpcHandler } from '../utils/ipcWrapper';
import { withFolderMarker } from '../utils/folderPathProbe.js';

import { notifyDataChanged } from './notifications.js';

interface UpdateItemByIdRequest {
  id: string;
  newItem: LauncherItem;
}

interface DeleteItemByIdRequest {
  id: string;
}

function convertLauncherItemToJsonItem(item: LauncherItem, existingId: string): JsonLauncherItem {
  return {
    id: existingId,
    type: 'item',
    displayName: item.displayName,
    path: item.path,
    ...(item.args && { args: item.args }),
    ...(item.customIcon && { customIcon: item.customIcon }),
    ...pickRunAsAdmin(item),
    ...pickItemWindowSwitch(item),
    ...(item.memo && { memo: item.memo }),
    ...(item.autoImportRuleId && { autoImportRuleId: item.autoImportRuleId }),
    updatedAt: Date.now(),
  };
}

async function updateItemById(
  configFolder: string,
  { id, newItem }: UpdateItemByIdRequest
): Promise<void> {
  // 1 件の編集は利用者の操作なので、パスが変わっていなくても確かめる（既存のアイテムも編集で直る）
  const path = await withFolderMarker(newItem.path);
  replaceItemById(
    configFolder,
    convertLauncherItemToJsonItem(
      path === newItem.path ? newItem : { ...newItem, path, type: 'folder' },
      id
    )
  );
}

/**
 * ID を指定したアイテムの更新・削除。書き込みは dataItemWriter に任せる（CLI と同じ処理）
 */
export function registerEditHandlers(configFolder: string): void {
  createSafeIpcHandler(
    IPC_CHANNELS.UPDATE_ITEM_BY_ID,
    async (request: UpdateItemByIdRequest) => {
      await updateItemById(configFolder, request);
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの更新（IDベース）'
  );

  createSafeIpcHandler(
    IPC_CHANNELS.DELETE_ITEMS_BY_ID,
    async (requests: DeleteItemByIdRequest[], options?: { keepClipboardDataRefs?: string[] }) => {
      await deleteItemsById(
        configFolder,
        requests.map((r) => r.id),
        options
      );
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの削除（IDベース）'
  );

  createSafeIpcHandler(
    IPC_CHANNELS.FIND_SETS_USING_ITEMS,
    async (ids: string[]) => findSetNamesUsingItemIds(configFolder, ids),
    'アイテムを使っているセットの検索'
  );
}
