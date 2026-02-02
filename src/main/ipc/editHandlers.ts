import * as fs from 'fs';
import * as path from 'path';

import { LauncherItem, JsonLauncherItem, isJsonClipboardItem } from '@common/types';
import { parseJsonDataFile, serializeJsonDataFile } from '@common/utils/jsonParser';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { createSafeIpcHandler } from '../utils/ipcWrapper';
import { BackupService } from '../services/backupService.js';
import { ClipboardService } from '../services/clipboardService.js';

import { notifyDataChanged } from './dataHandlers.js';

interface UpdateItemByIdRequest {
  id: string;
  newItem: LauncherItem;
}

interface DeleteItemByIdRequest {
  id: string;
}

async function createBackup(configFolder: string, fileName: string): Promise<void> {
  const filePath = path.join(configFolder, fileName);
  const backupService = await BackupService.getInstance();
  await backupService.createBackup(filePath);
}

/**
 * LauncherItemをJsonLauncherItemに変換する
 */
function convertLauncherItemToJsonItem(item: LauncherItem, existingId: string): JsonLauncherItem {
  const jsonItem: JsonLauncherItem = {
    id: existingId,
    type: 'item',
    displayName: item.displayName,
    path: item.path,
  };

  if (item.args) {
    jsonItem.args = item.args;
  }
  if (item.customIcon) {
    jsonItem.customIcon = item.customIcon;
  }
  if (item.windowConfig) {
    jsonItem.windowConfig = item.windowConfig;
  }
  if (item.memo) {
    jsonItem.memo = item.memo;
  }

  return jsonItem;
}

/**
 * 指定されたアイテムをIDで更新する
 */
export async function updateItemById(
  configFolder: string,
  request: UpdateItemByIdRequest
): Promise<void> {
  const { id, newItem } = request;
  const { PathManager } = await import('../config/pathManager.js');
  const dataFiles = PathManager.getDataFiles();

  // 全データファイルからIDで検索
  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    const jsonData = parseJsonDataFile(content);
    const itemIndex = jsonData.items.findIndex((item) => item.id === id);

    if (itemIndex !== -1) {
      // バックアップ作成
      await createBackup(configFolder, fileName);

      // アイテム更新（IDを保持）
      const updatedItem = convertLauncherItemToJsonItem(newItem, id);
      jsonData.items[itemIndex] = updatedItem;

      // 保存
      const newContent = serializeJsonDataFile(jsonData);
      fs.writeFileSync(filePath, newContent, 'utf8');
      return;
    }
  }

  throw new Error(`ID ${id} のアイテムが見つかりません`);
}

/**
 * 複数のアイテムをIDで削除する
 *
 * 複数ファイルにまたがる削除リクエストを効率的に処理します。
 * IDで検索してアイテムを削除します。
 */
export async function deleteItemsById(
  configFolder: string,
  requests: DeleteItemByIdRequest[]
): Promise<void> {
  const { PathManager } = await import('../config/pathManager.js');
  const dataFiles = PathManager.getDataFiles();
  const idsToDelete = new Set(requests.map((r) => r.id));

  // 各データファイルを処理
  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    const jsonData = parseJsonDataFile(content);

    // このファイルに削除対象のIDが含まれているか確認
    const hasTargetItems = jsonData.items.some((item) => idsToDelete.has(item.id));

    if (hasTargetItems) {
      // バックアップ作成
      await createBackup(configFolder, fileName);

      // クリップボードアイテムの場合、データファイルも削除
      const clipboardService = ClipboardService.getInstance();
      for (const item of jsonData.items) {
        if (idsToDelete.has(item.id) && isJsonClipboardItem(item)) {
          await clipboardService.deleteClipboardData(item.dataFileRef);
        }
      }

      // 削除対象以外のアイテムをフィルタリング
      const newItems = jsonData.items.filter((item) => !idsToDelete.has(item.id));

      // 保存
      const newContent = serializeJsonDataFile({ ...jsonData, items: newItems });
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
  }
}

/**
 * 複数のアイテムをIDで一括更新する
 *
 * ドラッグ&ドロップによる並び替えなど、複数アイテムを同時に更新する際に使用します。
 * 全データファイルを処理し、各ファイルに対して1回のバックアップと書き込みで完了します。
 */
export async function batchUpdateItemsById(
  configFolder: string,
  requests: UpdateItemByIdRequest[]
): Promise<void> {
  const { PathManager } = await import('../config/pathManager.js');
  const dataFiles = PathManager.getDataFiles();

  // 更新対象のIDをMapに格納
  const updateMap = new Map(requests.map((r) => [r.id, r.newItem]));

  // 各データファイルを処理
  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    const jsonData = parseJsonDataFile(content);

    // このファイルに更新対象のIDが含まれているか確認
    const hasTargetItems = jsonData.items.some((item) => updateMap.has(item.id));

    if (hasTargetItems) {
      // バックアップ作成
      await createBackup(configFolder, fileName);

      // アイテムを更新
      const newItems = jsonData.items.map((item) => {
        const newItem = updateMap.get(item.id);
        if (newItem) {
          return convertLauncherItemToJsonItem(newItem, item.id);
        }
        return item;
      });

      // 保存
      const newContent = serializeJsonDataFile({ ...jsonData, items: newItems });
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
  }
}

// Register IPC handlers
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
    async (requests: DeleteItemByIdRequest[]) => {
      await deleteItemsById(configFolder, requests);
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの削除（IDベース）'
  );

  createSafeIpcHandler(
    IPC_CHANNELS.BATCH_UPDATE_ITEMS_BY_ID,
    async (requests: UpdateItemByIdRequest[]) => {
      await batchUpdateItemsById(configFolder, requests);
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの一括更新（IDベース）'
  );
}
