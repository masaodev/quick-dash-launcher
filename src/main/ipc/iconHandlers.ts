import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { IconFetchErrorService } from '../services/iconFetchErrorService.js';
import { getMainWindow } from '../windowManager.js';
import type { IconFolders } from '../utils/iconCacheKeys.js';
import {
  ensureIcons,
  fetchFavicon,
  fetchIconsCombined,
  getIconForItem,
  loadCachedIcons,
  type IconItem,
} from '../services/icon/iconFetcher.js';
import {
  extractCustomUriIcon,
  extractFileIconByExtension,
  extractIcon,
} from '../services/icon/fileIconExtractor.js';
import { extractUwpIcon } from '../services/icon/uwpIconExtractor.js';
import {
  deleteCustomIcon,
  getCustomIcon,
  saveCustomIcon,
  selectCustomIconFile,
} from '../services/icon/customIconStore.js';

export function setupIconHandlers(
  faviconsFolder: string,
  iconsFolder: string,
  extensionsFolder: string
) {
  const folders: IconFolders = {
    favicons: faviconsFolder,
    icons: iconsFolder,
    extensions: extensionsFolder,
  };

  ipcMain.handle(IPC_CHANNELS.FETCH_FAVICON, (_event, url: string) =>
    fetchFavicon(url, faviconsFolder)
  );

  ipcMain.handle(IPC_CHANNELS.EXTRACT_ICON, (_event, filePath: string) =>
    filePath.startsWith('shell:AppsFolder\\')
      ? extractUwpIcon(filePath, iconsFolder)
      : extractIcon(filePath, iconsFolder)
  );

  ipcMain.handle(IPC_CHANNELS.EXTRACT_FILE_ICON_BY_EXTENSION, (_event, filePath: string) =>
    extractFileIconByExtension(filePath, extensionsFolder)
  );

  ipcMain.handle(IPC_CHANNELS.EXTRACT_CUSTOM_URI_ICON, (_event, uri: string) =>
    extractCustomUriIcon(uri, iconsFolder)
  );

  ipcMain.handle(IPC_CHANNELS.LOAD_CACHED_ICONS, (_event, items: IconItem[]) =>
    loadCachedIcons(items, folders)
  );

  // 統合進捗API（進捗はメインウィンドウの進捗バーに表示する）
  ipcMain.handle(
    IPC_CHANNELS.FETCH_ICONS_COMBINED,
    (_event, urlItems: IconItem[], items: IconItem[], forceRefresh: boolean = false) =>
      fetchIconsCombined(urlItems, items, folders, forceRefresh, getMainWindow())
  );

  // キャッシュ欠損の補完API（進捗通知なし）
  ipcMain.handle(IPC_CHANNELS.ENSURE_ICONS, (_event, items: IconItem[]) =>
    ensureIcons(items, folders)
  );

  // アイコン取得エラー記録をクリア
  ipcMain.handle(IPC_CHANNELS.CLEAR_ICON_FETCH_ERRORS, async () => {
    await (await IconFetchErrorService.getInstance()).clearAllErrors();
    return { success: true };
  });

  // アイコン取得エラー記録を取得
  ipcMain.handle(IPC_CHANNELS.GET_ICON_FETCH_ERRORS, async () =>
    (await IconFetchErrorService.getInstance()).getAllErrors()
  );

  // カスタムアイコン関連のハンドラー
  ipcMain.handle(IPC_CHANNELS.SELECT_CUSTOM_ICON_FILE, selectCustomIconFile);

  ipcMain.handle(
    IPC_CHANNELS.SAVE_CUSTOM_ICON,
    (_event, sourceFilePath: string, itemIdentifier: string) =>
      saveCustomIcon(sourceFilePath, itemIdentifier)
  );

  ipcMain.handle(IPC_CHANNELS.DELETE_CUSTOM_ICON, (_event, customIconFileName: string) =>
    deleteCustomIcon(customIconFileName)
  );

  ipcMain.handle(IPC_CHANNELS.GET_CUSTOM_ICON, (_event, customIconFileName: string) =>
    getCustomIcon(customIconFileName)
  );

  // IconService統合API
  ipcMain.handle(
    IPC_CHANNELS.GET_ICON_FOR_ITEM,
    (
      _event,
      filePath: string,
      itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'clipboard'
    ) => getIconForItem(filePath, itemType)
  );
}
