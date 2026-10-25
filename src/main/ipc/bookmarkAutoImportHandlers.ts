import { IPC_CHANNELS } from '@common/ipcChannels';
import type {
  BookmarkAutoImportRule,
  BookmarkAutoImportSettings,
} from '@common/types/bookmarkAutoImport';

import { SettingsService } from '../services/settingsService.js';
import { BookmarkAutoImportService } from '../services/bookmarkAutoImportService.js';
import { parseBrowserBookmarksWithFolders } from '../services/bookmarkReader.js';
import { handleIpc } from '../utils/ipcWrapper';

const autoImportService = new BookmarkAutoImportService();

export function setupBookmarkAutoImportHandlers(): void {
  handleIpc(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_GET_SETTINGS,
    async (): Promise<BookmarkAutoImportSettings> => {
      const settingsService = await SettingsService.getInstance();
      return settingsService.get('bookmarkAutoImport');
    }
  );

  handleIpc(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_SAVE_SETTINGS,
    async (_event, settings: BookmarkAutoImportSettings): Promise<void> => {
      const settingsService = await SettingsService.getInstance();
      await settingsService.set('bookmarkAutoImport', settings);
    }
  );

  handleIpc(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_EXECUTE_RULE,
    (_event, rule: BookmarkAutoImportRule) => autoImportService.executeRule(rule)
  );

  handleIpc(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_EXECUTE_ALL, () =>
    autoImportService.executeAllRules()
  );

  handleIpc(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_DELETE_RULE_ITEMS,
    (_event, ruleId: string, targetFile: string) =>
      autoImportService.deleteItemsByRuleId(ruleId, targetFile)
  );

  handleIpc(
    IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_GET_BOOKMARKS_WITH_FOLDERS,
    (_event, bookmarkPath: string) => parseBrowserBookmarksWithFolders(bookmarkPath)
  );
}
