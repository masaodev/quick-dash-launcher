import * as fs from 'fs';

import {
  BrowserWindow,
  dialog,
  ipcMain,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron';
import type { EditableJsonItem } from '@common/types/editableItem';
import type { ItemPathPickKind, JsonDirOptions, SetItemFields } from '@common/types';
import type { RegisterItem } from '@common/types/register';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { PathManager } from '../config/pathManager.js';
import { mainI18n } from '../services/mainI18n.js';
import { decodeCsvText } from '../utils/csvText.js';
import { LaunchUsageService } from '../services/launchUsageService.js';
import { checkPathsExist } from '../services/data/pathExistenceChecker.js';
import { getPathKind, withFolderMarker } from '../utils/folderPathProbe.js';
import { getDefaultBrowser, getFileHandler } from '../utils/defaultBrowser.js';
import { selectItemPath } from '../utils/itemPathDialog.js';
import type { LoadTrigger } from '../services/loadReportService.js';
import { reloadConfigFiles } from '../services/data/dataFileLoader.js';
import { loadEditableItems, saveEditableItems } from '../services/data/editableItemsStore.js';
import {
  registerItems,
  updateDirItemById,
  updateSetItemById,
} from '../services/data/dataItemWriter.js';
import { createDataFile, deleteDataFile } from '../services/data/dataFileOps.js';
import { previewDirectoryItems } from '../services/data/directoryScanner.js';

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

  ipcMain.handle(IPC_CHANNELS.CREATE_DATA_FILE, (_event, fileName: string) =>
    createDataFile(configFolder, fileName)
  );

  ipcMain.handle(IPC_CHANNELS.DELETE_DATA_FILE, (_event, fileName: string) =>
    deleteDataFile(configFolder, fileName)
  );

  // メイン画面の初回読み込み・F5。ワークスペースも含めて読み直し、レポートを書く
  ipcMain.handle(IPC_CHANNELS.LOAD_DATA_FILES, (_event, trigger?: LoadTrigger) =>
    reloadConfigFiles(configFolder, trigger)
  );

  ipcMain.handle(IPC_CHANNELS.REGISTER_ITEMS, async (_event, items: RegisterItem[]) => {
    const marked = await Promise.all(
      items.map(async (item) => {
        if (item.itemCategory !== 'item') return item;
        const path = await withFolderMarker(item.path);
        return path === item.path ? item : { ...item, path, type: 'folder' as const };
      })
    );
    await registerItems(configFolder, marked);
    notifyDataChanged();
  });

  ipcMain.handle(IPC_CHANNELS.PATH_GET_KIND, (_event, filePath: string) => getPathKind(filePath));

  ipcMain.handle(IPC_CHANNELS.PATH_SELECT, (event, kind: ItemPathPickKind, currentPath?: string) =>
    selectItemPath(kind, currentPath, BrowserWindow.fromWebContents(event.sender))
  );

  // フォルダ取込のプレビュー。画面ごとに走査中のものを 1 つだけ持ち、新しく始めたら前のものはやめる
  const dirPreviews = new Map<number, AbortController>();
  ipcMain.handle(
    IPC_CHANNELS.DIR_PREVIEW_RUN,
    async (event, dirPath: string, options: JsonDirOptions) => {
      const senderId = event.sender.id;
      dirPreviews.get(senderId)?.abort();
      const controller = new AbortController();
      dirPreviews.set(senderId, controller);
      try {
        return await previewDirectoryItems(dirPath, options, controller.signal);
      } finally {
        if (dirPreviews.get(senderId) === controller) dirPreviews.delete(senderId);
      }
    }
  );
  ipcMain.handle(IPC_CHANNELS.DIR_PREVIEW_CANCEL, (event) => {
    dirPreviews.get(event.sender.id)?.abort();
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_GET_DEFAULT, () => getDefaultBrowser());
  ipcMain.handle(IPC_CHANNELS.FILE_GET_HANDLER, (_event, extension: string) =>
    getFileHandler(extension)
  );

  // アイテム管理の「リンク切れを確認」。確認対象の絞り込み（URL・shell:・裸のコマンド名を除く）は呼び出し側が行う。
  // 応答しないネットワークパスで止まらないよう、時間切れ付きの非同期確認にしている
  ipcMain.handle(IPC_CHANNELS.CHECK_PATHS_EXIST, (_event, paths: string[]) =>
    checkPathsExist(paths)
  );

  // アイテム管理の CSV。Excel でダブルクリックして開いても日本語が化けないよう BOM 付きで書く
  ipcMain.handle(
    IPC_CHANNELS.ITEMS_CSV_EXPORT,
    async (event, text: string, defaultName: string): Promise<string | null> => {
      const parent = BrowserWindow.fromWebContents(event.sender);
      const options: SaveDialogOptions = {
        title: mainI18n.t('itemCsv.exportTitle'),
        defaultPath: defaultName,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      };
      const result = parent
        ? await dialog.showSaveDialog(parent, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return null;
      await fs.promises.writeFile(result.filePath, '\uFEFF' + text, 'utf8');
      return result.filePath;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.GET_LAUNCH_USAGE,
    () =>
      LaunchUsageService.getInstance()?.getSnapshot() ?? {
        since: Date.now(),
        byId: {},
        byPath: {},
      }
  );

  ipcMain.handle(IPC_CHANNELS.ITEMS_CSV_READ, async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      title: mainI18n.t('itemCsv.importTitle'),
      filters: [
        { name: 'CSV', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    const filePath = result.canceled ? undefined : result.filePaths[0];
    if (!filePath) return null;
    return { filePath, text: decodeCsvText(await fs.promises.readFile(filePath)) };
  });

  // EditableJsonItem API
  ipcMain.handle(IPC_CHANNELS.LOAD_EDITABLE_ITEMS, () => loadEditableItems(configFolder));

  ipcMain.handle(
    IPC_CHANNELS.SAVE_EDITABLE_ITEMS,
    async (_event, editableItems: EditableJsonItem[], expectedHashes?: Record<string, string>) => {
      const result = await saveEditableItems(configFolder, editableItems, expectedHashes);
      if (result.writtenFiles.length > 0) {
        notifyDataChanged();
      }
      return result;
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
    IPC_CHANNELS.UPDATE_SET_ITEM_BY_ID,
    async (_event, id: string, set: SetItemFields, memo?: string) => {
      updateSetItemById(configFolder, id, set, memo);
      notifyDataChanged();
    }
  );
}
