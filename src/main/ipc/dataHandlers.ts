import * as fs from 'fs';
import * as path from 'path';

import { ipcMain } from 'electron';
import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { serializeJsonDataFile, createEmptyJsonDataFile } from '@common/utils/jsonParser';
import type { EditableJsonItem } from '@common/types/editableItem';
import { DEFAULT_DATA_FILE } from '@common/types';
import type { JsonDirOptions, LayoutWindowEntry, WindowItemConfig } from '@common/types';
import type { RegisterItem } from '@common/types/register';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { SettingsService } from '../services/settingsService.js';
import { PathManager } from '../config/pathManager.js';
import { forgetDataFile, writeDataFile } from '../services/dataFileTracker.js';
import type { LoadTrigger } from '../services/loadReportService.js';
import { reloadConfigFiles } from '../services/data/dataFileLoader.js';
import { loadEditableItems, saveEditableItems } from '../services/data/editableItemsStore.js';
import {
  registerItems,
  updateDirItemById,
  updateGroupItemById,
  updateLayoutItemById,
  updateWindowItemById,
} from '../services/data/dataItemWriter.js';

import { setupBookmarkHandlers } from './bookmarkHandlers.js';
import { notifyDataChanged } from './notifications.js';
import { setupAppImportHandlers } from './appImportHandlers.js';

export function setupDataHandlers(configFolder: string) {
  // ブックマーク関連のハンドラーを登録
  setupBookmarkHandlers();

  // アプリインポート関連のハンドラーを登録
  setupAppImportHandlers();

  ipcMain.handle(IPC_CHANNELS.GET_CONFIG_FOLDER, () => configFolder);

  ipcMain.handle(IPC_CHANNELS.GET_DATA_FILES, () => PathManager.getDataFiles());

  ipcMain.handle(IPC_CHANNELS.CREATE_DATA_FILE, async (_event, fileName: string) => {
    const filePath = path.join(configFolder, fileName);
    dataLogger.info(`create-data-file called: ${fileName} at ${filePath}`);

    if (FileUtils.exists(filePath)) {
      dataLogger.warn(`File already exists: ${filePath}`);
      return { success: false, error: 'ファイルは既に存在します' };
    }

    try {
      const emptyData = serializeJsonDataFile(createEmptyJsonDataFile());
      writeDataFile(filePath, emptyData);
      dataLogger.info(`File created successfully: ${filePath}`);
      return { success: true };
    } catch (error) {
      dataLogger.error({ error, filePath }, 'Failed to create file');
      return { success: false, error: `ファイルの作成に失敗しました: ${error}` };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_DATA_FILE, async (_event, fileName: string) => {
    if (fileName === DEFAULT_DATA_FILE) {
      return { success: false, error: 'メインデータファイルは削除できません' };
    }

    const filePath = path.join(configFolder, fileName);

    try {
      await fs.promises.unlink(filePath);
      forgetDataFile(fileName);

      // 削除されたファイルを targetFile に持つ自動取込ルールを無効化
      const settingsService = await SettingsService.getInstance();
      const autoImportSettings = await settingsService.get('bookmarkAutoImport');
      const rulesToDisable =
        autoImportSettings?.rules?.filter((r) => r.targetFile === fileName && r.enabled) ?? [];

      if (rulesToDisable.length > 0) {
        for (const rule of rulesToDisable) {
          rule.enabled = false;
        }
        await settingsService.set('bookmarkAutoImport', autoImportSettings);
        dataLogger.info(
          { disabledRules: rulesToDisable.map((r) => r.name), fileName },
          'データファイル削除に伴い自動取込ルールを無効化しました'
        );
      }

      return { success: true, disabledRules: rulesToDisable.map((r) => r.name) };
    } catch (error) {
      return { success: false, error: `ファイルの削除に失敗しました: ${error}` };
    }
  });

  // メイン画面の初回読み込み・F5。ワークスペースも含めて読み直し、レポートを書く
  ipcMain.handle(IPC_CHANNELS.LOAD_DATA_FILES, (_event, trigger?: LoadTrigger) =>
    reloadConfigFiles(configFolder, trigger)
  );

  ipcMain.handle(IPC_CHANNELS.REGISTER_ITEMS, async (_event, items: RegisterItem[]) => {
    await registerItems(configFolder, items);
    notifyDataChanged();
  });

  ipcMain.handle(IPC_CHANNELS.IS_DIRECTORY, (_event, filePath: string) =>
    FileUtils.isDirectory(filePath)
  );

  // EditableJsonItem API
  ipcMain.handle(IPC_CHANNELS.LOAD_EDITABLE_ITEMS, () => loadEditableItems(configFolder));

  ipcMain.handle(
    IPC_CHANNELS.SAVE_EDITABLE_ITEMS,
    async (_event, editableItems: EditableJsonItem[], expectedHashes?: Record<string, string>) => {
      await saveEditableItems(configFolder, editableItems, expectedHashes);
      notifyDataChanged();
    }
  );

  // IDベースのアイテム更新
  ipcMain.handle(
    IPC_CHANNELS.UPDATE_DIR_ITEM_BY_ID,
    async (_event, id: string, dirPath: string, options?: JsonDirOptions, memo?: string) => {
      updateDirItemById(configFolder, id, dirPath, options, memo);
      notifyDataChanged();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_GROUP_ITEM_BY_ID,
    async (_event, id: string, displayName: string, itemNames: string[], memo?: string) => {
      updateGroupItemById(configFolder, id, displayName, itemNames, memo);
      notifyDataChanged();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_WINDOW_ITEM_BY_ID,
    async (_event, id: string, config: WindowItemConfig, memo?: string) => {
      updateWindowItemById(configFolder, id, config, memo);
      notifyDataChanged();
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_LAYOUT_ITEM_BY_ID,
    async (
      _event,
      id: string,
      displayName: string,
      entries: LayoutWindowEntry[],
      memo?: string
    ) => {
      updateLayoutItemById(configFolder, id, displayName, entries, memo);
      notifyDataChanged();
    }
  );
}
