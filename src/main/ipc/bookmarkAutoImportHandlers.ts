import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';
import type {
  BookmarkAutoImportRule,
  BookmarkAutoImportSettings,
} from '@common/types/bookmarkAutoImport';

import { SettingsService } from '../services/settingsService.js';
import { BookmarkAutoImportService } from '../services/bookmarkAutoImportService.js';

import {
  parseBrowserBookmarkFolders,
  parseBrowserBookmarksWithFolders,
} from './bookmarkHandlers.js';

const autoImportService = new BookmarkAutoImportService();

export function setupBookmarkAutoImportHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_GET_SETTINGS,
    async (): Promise<BookmarkAutoImportSettings> => {
      const settingsService = await SettingsService.getInstance();
      return settingsService.get('bookmarkAutoImport');
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_SAVE_SETTINGS,
    async (_event, settings: BookmarkAutoImportSettings): Promise<void> => {
      const settingsService = await SettingsService.getInstance();
      await settingsService.set('bookmarkAutoImport', settings);
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_EXECUTE_RULE,
    (_event, rule: BookmarkAutoImportRule) => autoImportService.executeRule(rule)
  );

  ipcMain.handle(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_EXECUTE_ALL, () =>
    autoImportService.executeAllRules()
  );

  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_PREVIEW_RULE,
    (_event, rule: BookmarkAutoImportRule) => autoImportService.previewRule(rule)
  );

  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_DELETE_RULE_ITEMS,
    (_event, ruleId: string, targetFile: string) =>
      autoImportService.deleteItemsByRuleId(ruleId, targetFile)
  );

  ipcMain.handle(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_GET_FOLDERS, (_event, bookmarkPath: string) =>
    parseBrowserBookmarkFolders(bookmarkPath)
  );

  ipcMain.handle(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_GET_BOOKMARKS_WITH_FOLDERS,
    (_event, bookmarkPath: string) => parseBrowserBookmarksWithFolders(bookmarkPath)
  );
}
