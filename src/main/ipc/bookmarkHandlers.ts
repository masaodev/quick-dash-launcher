import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { mainI18n } from '../services/mainI18n.js';
import {
  detectInstalledBrowsers,
  parseBookmarkFileWithFolders,
} from '../services/bookmarkReader.js';

/**
 * ブックマーク関連のIPCハンドラーを登録する
 */
export function setupBookmarkHandlers() {
  ipcMain.handle(IPC_CHANNELS.SELECT_BOOKMARK_FILE, async () => {
    const result = await dialog.showOpenDialog({
      title: mainI18n.t('bookmarkErrors.selectFileTitle'),
      filters: [
        { name: 'HTML Files', extensions: ['html', 'htm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle(IPC_CHANNELS.PARSE_BOOKMARK_FILE_WITH_FOLDERS, (_event, filePath: string) =>
    parseBookmarkFileWithFolders(filePath)
  );

  // ブラウザブックマーク直接インポートAPI
  ipcMain.handle(IPC_CHANNELS.DETECT_INSTALLED_BROWSERS, detectInstalledBrowsers);
}
