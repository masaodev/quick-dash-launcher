import { contextBridge, ipcRenderer, webUtils } from 'electron';

import {
  LauncherItem,
  RawDataLine,
  AppSettings,
  IconProgress,
  WindowPinMode,
} from '../common/types';

interface RegisterItem {
  filePath: string;
  displayName: string;
  itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  fullArgs?: string;
}

interface UpdateItemRequest {
  sourceFile: 'data.txt' | 'data2.txt';
  lineNumber: number;
  newItem: LauncherItem;
}

interface DeleteItemRequest {
  sourceFile: 'data.txt' | 'data2.txt';
  lineNumber: number;
}

contextBridge.exposeInMainWorld('electronAPI', {
  getConfigFolder: () => ipcRenderer.invoke('get-config-folder'),
  loadDataFiles: () => ipcRenderer.invoke('load-data-files'),
  openItem: (item: LauncherItem) => ipcRenderer.invoke('open-item', item),
  openParentFolder: (item: LauncherItem) => ipcRenderer.invoke('open-parent-folder', item),
  openConfigFolder: () => ipcRenderer.invoke('open-config-folder'),
  openDataFile: () => ipcRenderer.invoke('open-data-file'),
  fetchFavicon: (url: string) => ipcRenderer.invoke('fetch-favicon', url),
  extractIcon: (filePath: string) => ipcRenderer.invoke('extract-icon', filePath),
  extractFileIconByExtension: (filePath: string) =>
    ipcRenderer.invoke('extract-file-icon-by-extension', filePath),
  extractCustomUriIcon: (uri: string) => ipcRenderer.invoke('extract-custom-uri-icon', uri),
  loadCachedIcons: (items: LauncherItem[]) => ipcRenderer.invoke('load-cached-icons', items),
  // 進捗付きアイコン取得API
  fetchFaviconsWithProgress: (urls: string[]) =>
    ipcRenderer.invoke('fetch-favicons-with-progress', urls),
  extractIconsWithProgress: (items: LauncherItem[]) =>
    ipcRenderer.invoke('extract-icons-with-progress', items),
  // 進捗イベントリスナー
  onIconProgress: (
    eventType: 'start' | 'update' | 'complete',
    callback: (data: IconProgress) => void
  ) => {
    ipcRenderer.on(`icon-progress-${eventType}`, (_event, data) => callback(data));
  },
  onWindowShown: (callback: () => void) => {
    ipcRenderer.on('window-shown', callback);
  },
  onSetActiveTab: (callback: (tab: 'settings' | 'edit' | 'other') => void) => {
    ipcRenderer.on('set-active-tab', (_event, tab) => callback(tab));
  },
  // 新しい3段階ピンモードAPI
  getWindowPinMode: (): Promise<WindowPinMode> => ipcRenderer.invoke('get-window-pin-mode'),
  cycleWindowPinMode: () => ipcRenderer.invoke('cycle-window-pin-mode'),
  // 旧APIとの互換性（非推奨）
  getWindowPinState: () => ipcRenderer.invoke('get-window-pin-state'),
  setWindowPinState: (isPinned: boolean) => ipcRenderer.invoke('set-window-pin-state', isPinned),
  registerItems: (items: RegisterItem[]) => ipcRenderer.invoke('register-items', items),
  isDirectory: (filePath: string) => ipcRenderer.invoke('is-directory', filePath),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  updateItem: (request: UpdateItemRequest) => ipcRenderer.invoke('update-item', request),
  deleteItems: (requests: DeleteItemRequest[]) => ipcRenderer.invoke('delete-items', requests),
  batchUpdateItems: (requests: UpdateItemRequest[]) =>
    ipcRenderer.invoke('batch-update-items', requests),
  loadRawDataFiles: () => ipcRenderer.invoke('load-raw-data-files'),
  saveRawDataFiles: (rawLines: RawDataLine[]) =>
    ipcRenderer.invoke('save-raw-data-files', rawLines),
  setEditMode: (editMode: boolean) => ipcRenderer.invoke('set-edit-mode', editMode),
  getEditMode: () => ipcRenderer.invoke('get-edit-mode'),
  selectBookmarkFile: () => ipcRenderer.invoke('select-bookmark-file'),
  parseBookmarkFile: (filePath: string) => ipcRenderer.invoke('parse-bookmark-file', filePath),
  // Settings API
  getSettings: (key?: keyof AppSettings) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) =>
    ipcRenderer.invoke('settings:set', key, value),
  setMultipleSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:set-multiple', settings),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  validateHotkey: (hotkey: string) => ipcRenderer.invoke('settings:validate-hotkey', hotkey),
  getSettingsConfigPath: () => ipcRenderer.invoke('settings:get-config-path'),
  changeHotkey: (newHotkey: string) => ipcRenderer.invoke('settings:change-hotkey', newHotkey),
  checkHotkeyAvailability: (hotkey: string) =>
    ipcRenderer.invoke('settings:check-hotkey-availability', hotkey),
  // 編集ウィンドウ関連API
  showEditWindow: () => ipcRenderer.invoke('show-edit-window'),
  hideEditWindow: () => ipcRenderer.invoke('hide-edit-window'),
  toggleEditWindow: () => ipcRenderer.invoke('toggle-edit-window'),
  isEditWindowShown: () => ipcRenderer.invoke('is-edit-window-shown'),
  openEditWindowWithTab: (tab: 'settings' | 'edit' | 'other') =>
    ipcRenderer.invoke('open-edit-window-with-tab', tab),
  getInitialTab: () => ipcRenderer.invoke('get-initial-tab'),
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
});
