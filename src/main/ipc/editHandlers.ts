import * as fs from 'fs';
import * as path from 'path';

import { editLogger } from '@common/logger';
import { LauncherItem, JsonItem, JsonLauncherItem } from '@common/types';
import { parseJsonDataFile, serializeJsonDataFile } from '@common/utils/jsonParser';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { createSafeIpcHandler } from '../utils/ipcWrapper';
import { BackupService } from '../services/backupService.js';

import { notifyDataChanged } from './dataHandlers.js';

interface UpdateItemRequest {
  sourceFile: string;
  lineNumber: number;
  newItem: LauncherItem;
}

interface DeleteItemRequest {
  sourceFile: string;
  lineNumber: number;
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

  return jsonItem;
}

/**
 * JSONファイルのアイテムを更新する
 */
class JsonFileEditor {
  static readAndParse(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return parseJsonDataFile(content);
  }

  static write(filePath: string, data: ReturnType<typeof parseJsonDataFile>) {
    const content = serializeJsonDataFile(data);
    fs.writeFileSync(filePath, content, 'utf8');
  }

  static async editWithBackup(
    configFolder: string,
    fileName: string,
    editFunc: (items: JsonItem[]) => JsonItem[]
  ): Promise<void> {
    const filePath = path.join(configFolder, fileName);

    // バックアップ作成
    await createBackup(configFolder, fileName);

    // JSONファイル読み込み
    const jsonData = this.readAndParse(filePath);

    // 編集処理実行
    const newItems = editFunc(jsonData.items);

    // 書き込み
    this.write(filePath, { ...jsonData, items: newItems });
  }
}

/**
 * 指定されたアイテムを更新する
 *
 * インデックス（lineNumber - 1）でアイテムを特定し更新します。
 */
export async function updateItem(configFolder: string, request: UpdateItemRequest): Promise<void> {
  const { sourceFile, lineNumber, newItem } = request;

  await JsonFileEditor.editWithBackup(configFolder, sourceFile, (items) => {
    const itemIndex = lineNumber - 1; // 1-indexed → 0-indexed
    if (itemIndex < 0 || itemIndex >= items.length) {
      throw new Error(`Invalid item index: ${itemIndex}`);
    }

    // 既存アイテムのIDを保持して更新
    const existingItem = items[itemIndex];
    const updatedItem = convertLauncherItemToJsonItem(newItem, existingItem.id);

    // アイテムを置き換え
    const newItems = [...items];
    newItems[itemIndex] = updatedItem;
    return newItems;
  });
}

/**
 * 複数のアイテムを削除する
 *
 * 複数ファイルにまたがる削除リクエストを効率的に処理します。
 * ファイルごとにグループ化し、各ファイルに対して1回のバックアップと書き込みで完了します。
 *
 * 重要: 削除時はインデックスがシフトするため、降順でソートしてから削除します。
 */
export async function deleteItems(
  configFolder: string,
  requests: DeleteItemRequest[]
): Promise<void> {
  // リクエストをファイルごとにグループ化
  const fileGroups = new Map<string, DeleteItemRequest[]>();
  requests.forEach((request) => {
    if (!fileGroups.has(request.sourceFile)) {
      fileGroups.set(request.sourceFile, []);
    }
    const group = fileGroups.get(request.sourceFile);
    if (!group) {
      throw new Error(`Failed to get file group for: ${request.sourceFile}`);
    }
    group.push(request);
  });

  // 各ファイルを個別に処理
  for (const [sourceFile, fileRequests] of fileGroups) {
    try {
      await JsonFileEditor.editWithBackup(configFolder, sourceFile, (items) => {
        // インデックスシフトを避けるため、行番号を降順にソート
        const sortedRequests = fileRequests.sort((a, b) => b.lineNumber - a.lineNumber);

        const newItems = [...items];
        // アイテムを削除（後ろから削除することで、前のインデックスに影響しない）
        for (const request of sortedRequests) {
          const itemIndex = request.lineNumber - 1;
          if (itemIndex >= 0 && itemIndex < newItems.length) {
            newItems.splice(itemIndex, 1);
          }
        }
        return newItems;
      });
    } catch (error) {
      // ファイルが存在しない場合はスキップして続行
      editLogger.warn({ sourceFile, error }, 'ファイルが存在しません、スキップします');
    }
  }
}

/**
 * 複数のアイテムを一括更新する
 *
 * ドラッグ&ドロップによる並び替えなど、複数アイテムを同時に更新する際に使用します。
 * ファイルごとにグループ化し、各ファイルに対して1回のバックアップと書き込みで完了します。
 *
 * パフォーマンス: 100個のアイテムを更新する場合でも、同じファイル内であれば
 * 1回のファイル読み書きで完了するため、効率的です。
 */
export async function batchUpdateItems(
  configFolder: string,
  requests: UpdateItemRequest[]
): Promise<void> {
  // リクエストをファイルごとにグループ化
  const fileGroups = new Map<string, UpdateItemRequest[]>();
  requests.forEach((request) => {
    if (!fileGroups.has(request.sourceFile)) {
      fileGroups.set(request.sourceFile, []);
    }
    const group = fileGroups.get(request.sourceFile);
    if (!group) {
      throw new Error(`Failed to get file group for: ${request.sourceFile}`);
    }
    group.push(request);
  });

  // 各ファイルを個別に処理
  for (const [sourceFile, fileRequests] of fileGroups) {
    try {
      await JsonFileEditor.editWithBackup(configFolder, sourceFile, (items) => {
        const newItems = [...items];
        // ファイル内のすべての更新を適用
        for (const request of fileRequests) {
          const itemIndex = request.lineNumber - 1;
          if (itemIndex >= 0 && itemIndex < newItems.length) {
            const existingItem = newItems[itemIndex];
            newItems[itemIndex] = convertLauncherItemToJsonItem(request.newItem, existingItem.id);
          }
        }
        return newItems;
      });
    } catch (error) {
      // ファイルが存在しない場合はスキップして続行
      editLogger.warn({ sourceFile, error }, 'ファイルが存在しません、スキップします');
    }
  }
}

// Register IPC handlers
export function registerEditHandlers(configFolder: string): void {
  createSafeIpcHandler(
    IPC_CHANNELS.UPDATE_ITEM,
    async (request: UpdateItemRequest) => {
      await updateItem(configFolder, request);
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの更新'
  );

  createSafeIpcHandler(
    IPC_CHANNELS.DELETE_ITEMS,
    async (requests: DeleteItemRequest[]) => {
      await deleteItems(configFolder, requests);
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの削除'
  );

  createSafeIpcHandler(
    IPC_CHANNELS.BATCH_UPDATE_ITEMS,
    async (requests: UpdateItemRequest[]) => {
      await batchUpdateItems(configFolder, requests);
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの一括更新'
  );
}
