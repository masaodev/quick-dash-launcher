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
import { extractIcon } from '../services/icon/fileIconExtractor.js';
import { extractUwpIcon } from '../services/icon/uwpIconExtractor.js';
import {
  deleteCustomIcon,
  getCustomIcon,
  saveCustomIcon,
  selectCustomIconFile,
} from '../services/icon/customIconStore.js';
import { handleIpc } from '../utils/ipcWrapper';

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

  handleIpc(IPC_CHANNELS.FETCH_FAVICON, (_event, url: string) => fetchFavicon(url, faviconsFolder));

  handleIpc(IPC_CHANNELS.EXTRACT_ICON, (_event, filePath: string) =>
    filePath.startsWith('shell:AppsFolder\\')
      ? extractUwpIcon(filePath, iconsFolder)
      : extractIcon(filePath, iconsFolder)
  );

  handleIpc(IPC_CHANNELS.LOAD_CACHED_ICONS, (_event, items: IconItem[]) =>
    loadCachedIcons(items, folders)
  );

  // 統合進捗API（進捗はメインウィンドウの進捗バーに表示する。silent なら進捗を送らない）
  handleIpc(
    IPC_CHANNELS.FETCH_ICONS_COMBINED,
    (
      _event,
      urlItems: IconItem[],
      items: IconItem[],
      forceRefresh: boolean = false,
      silent: boolean = false
    ) => fetchIconsCombined(urlItems, items, folders, forceRefresh, silent ? null : getMainWindow())
  );

  // ほかのウィンドウからの「未取得のアイコンを取って」をメインウィンドウへ渡す（取得はメインウィンドウが流す）
  handleIpc(IPC_CHANNELS.REQUEST_FETCH_MISSING_ICONS, () => {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.EVENT_FETCH_MISSING_ICONS_REQUESTED);
    }
  });

  // キャッシュ欠損の補完API（進捗通知なし）
  handleIpc(IPC_CHANNELS.ENSURE_ICONS, (_event, items: IconItem[]) => ensureIcons(items, folders));

  // アイコン取得エラー記録を取得
  handleIpc(IPC_CHANNELS.GET_ICON_FETCH_ERRORS, async () =>
    (await IconFetchErrorService.getInstance()).getAllErrors()
  );

  // カスタムアイコン関連のハンドラー
  handleIpc(IPC_CHANNELS.SELECT_CUSTOM_ICON_FILE, selectCustomIconFile);

  handleIpc(
    IPC_CHANNELS.SAVE_CUSTOM_ICON,
    (_event, sourceFilePath: string, itemIdentifier: string) =>
      saveCustomIcon(sourceFilePath, itemIdentifier)
  );

  handleIpc(IPC_CHANNELS.DELETE_CUSTOM_ICON, (_event, customIconFileName: string) =>
    deleteCustomIcon(customIconFileName)
  );

  handleIpc(IPC_CHANNELS.GET_CUSTOM_ICON, (_event, customIconFileName: string) =>
    getCustomIcon(customIconFileName)
  );

  // IconService統合API
  handleIpc(
    IPC_CHANNELS.GET_ICON_FOR_ITEM,
    (
      _event,
      filePath: string,
      itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'windowSwitch' | 'clipboard'
    ) => getIconForItem(filePath, itemType)
  );
}
