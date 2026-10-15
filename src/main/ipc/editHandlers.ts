import * as fs from 'fs';
import * as path from 'path';

import { IPC_CHANNELS } from '@common/ipcChannels';
import { JsonDataFile, JsonLauncherItem, LauncherItem, isJsonClipboardItem } from '@common/types';
import { parseJsonDataFileLenient, serializeJsonDataFile } from '@common/utils/jsonParser';
import { FileUtils } from '@common/utils/fileUtils';

import { ClipboardService } from '../services/clipboardService.js';
import { writeDataFile } from '../services/dataFileTracker.js';
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
    ...(item.windowConfig && { windowConfig: item.windowConfig }),
    ...(item.memo && { memo: item.memo }),
    ...(item.autoImportRuleId && { autoImportRuleId: item.autoImportRuleId }),
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

  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    if (!fs.existsSync(filePath)) continue;

    const content = FileUtils.safeReadTextFile(filePath);
    if (content === null) continue;

    // 寛容パース: 不正なアイテムはファイル上に残したまま扱う
    const jsonData = parseJsonDataFileLenient(content).data;

    if (!predicate(jsonData)) continue;

    const result = await processor({ fileName, filePath, jsonData });

    if (result) {
      const newContent = serializeJsonDataFile(result);
      // アトミック書き込み＋トラッカーへ記憶（外部変更検知の誤検知を防ぐ）
      // 書けなかったら止める（保存先を変える編集が、消せていないのに同じ id で登録し直さないように）
      if (!writeDataFile(filePath, newContent)) {
        throw new Error(`データファイルに書き込めませんでした: ${fileName}`);
      }
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
      // 1 件の編集は利用者の操作なので、パスが変わっていなくても確かめる（既存のアイテムも編集で直る）
      const path = await withFolderMarker(newItem.path);
      jsonData.items[itemIndex] = convertLauncherItemToJsonItem(
        path === newItem.path ? newItem : { ...newItem, path, type: 'folder' },
        id
      );
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
}
