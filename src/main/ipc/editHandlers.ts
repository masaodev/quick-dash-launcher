import * as fs from 'fs';
import * as path from 'path';

import { IPC_CHANNELS } from '@common/ipcChannels';
import { JsonDataFile, JsonLauncherItem, LauncherItem, isJsonClipboardItem } from '@common/types';
import { parseJsonDataFile, serializeJsonDataFile } from '@common/utils/jsonParser';

import { BackupService } from '../services/backupService.js';
import { ClipboardService } from '../services/clipboardService.js';
import { createSafeIpcHandler } from '../utils/ipcWrapper';

import { notifyDataChanged } from './dataHandlers.js';

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
    ...(item.windowConfig && { windowConfig: item.windowConfig }),
    ...(item.memo && { memo: item.memo }),
    updatedAt: Date.now(),
  };
}

interface DataFileContext {
  fileName: string;
  filePath: string;
  jsonData: JsonDataFile;
}

async function processDataFiles(
  configFolder: string,
  predicate: (jsonData: JsonDataFile) => boolean,
  processor: (ctx: DataFileContext) => Promise<JsonDataFile | null>
): Promise<void> {
  const { PathManager } = await import('../config/pathManager.js');
  const dataFiles = PathManager.getDataFiles();
  const backupService = await BackupService.getInstance();

  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    const jsonData = parseJsonDataFile(content);

    if (!predicate(jsonData)) continue;

    await backupService.createBackup(filePath);
    const result = await processor({ fileName, filePath, jsonData });

    if (result) {
      const newContent = serializeJsonDataFile(result);
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
  }
}

export async function updateItemById(
  configFolder: string,
  request: UpdateItemByIdRequest
): Promise<void> {
  const { id, newItem } = request;
  let found = false;

  await processDataFiles(
    configFolder,
    (jsonData) => jsonData.items.some((item) => item.id === id),
    async ({ jsonData }) => {
      if (found) return null;

      const itemIndex = jsonData.items.findIndex((item) => item.id === id);
      if (itemIndex === -1) return null;

      found = true;
      jsonData.items[itemIndex] = convertLauncherItemToJsonItem(newItem, id);
      return jsonData;
    }
  );

  if (!found) {
    throw new Error(`ID ${id} のアイテムが見つかりません`);
  }
}

export async function deleteItemsById(
  configFolder: string,
  requests: DeleteItemByIdRequest[]
): Promise<void> {
  const idsToDelete = new Set(requests.map((r) => r.id));
  const clipboardService = ClipboardService.getInstance();

  await processDataFiles(
    configFolder,
    (jsonData) => jsonData.items.some((item) => idsToDelete.has(item.id)),
    async ({ jsonData }) => {
      for (const item of jsonData.items) {
        if (idsToDelete.has(item.id) && isJsonClipboardItem(item)) {
          await clipboardService.deleteClipboardData(item.dataFileRef);
        }
      }
      return { ...jsonData, items: jsonData.items.filter((item) => !idsToDelete.has(item.id)) };
    }
  );
}

export async function batchUpdateItemsById(
  configFolder: string,
  requests: UpdateItemByIdRequest[]
): Promise<void> {
  const updateMap = new Map(requests.map((r) => [r.id, r.newItem]));

  await processDataFiles(
    configFolder,
    (jsonData) => jsonData.items.some((item) => updateMap.has(item.id)),
    async ({ jsonData }) => {
      const newItems = jsonData.items.map((item) => {
        const newItem = updateMap.get(item.id);
        return newItem ? convertLauncherItemToJsonItem(newItem, item.id) : item;
      });
      return { ...jsonData, items: newItems };
    }
  );
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
