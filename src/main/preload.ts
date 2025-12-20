import { contextBridge, ipcRenderer, webUtils } from 'electron';

import {
  LauncherItem,
  RawDataLine,
  AppSettings,
  IconProgress,
  WindowPinMode,
  SearchHistoryEntry,
  GroupItem,
  AppItem,
  AppInfo,
  BrowserInfo,
  WorkspaceItem,
  WorkspaceGroup,
  ExecutionHistoryItem,
  WindowInfo,
} from '../common/types';

interface RegisterItem {
  filePath: string;
  displayName: string;
  itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  fullArgs?: string;
}

interface UpdateItemRequest {
  sourceFile: string;
  lineNumber: number;
  newItem: LauncherItem;
}

interface DeleteItemRequest {
  sourceFile: string;
  lineNumber: number;
}

contextBridge.exposeInMainWorld('electronAPI', {
  getConfigFolder: () => ipcRenderer.invoke('get-config-folder'),
  getDataFiles: (): Promise<string[]> => ipcRenderer.invoke('get-data-files'),
  createDataFile: (fileName: string) => ipcRenderer.invoke('create-data-file', fileName),
  deleteDataFile: (fileName: string) => ipcRenderer.invoke('delete-data-file', fileName),
  loadDataFiles: (): Promise<AppItem[]> => ipcRenderer.invoke('load-data-files'),
  openItem: (item: LauncherItem) => ipcRenderer.invoke('open-item', item),
  openParentFolder: (item: LauncherItem) => ipcRenderer.invoke('open-parent-folder', item),
  executeGroup: (group: GroupItem, allItems: AppItem[]) =>
    ipcRenderer.invoke('execute-group', group, allItems),
  openConfigFolder: () => ipcRenderer.invoke('open-config-folder'),
  fetchFavicon: (url: string) => ipcRenderer.invoke('fetch-favicon', url),
  extractIcon: (filePath: string) => ipcRenderer.invoke('extract-icon', filePath),
  extractFileIconByExtension: (filePath: string) =>
    ipcRenderer.invoke('extract-file-icon-by-extension', filePath),
  extractCustomUriIcon: (uri: string) => ipcRenderer.invoke('extract-custom-uri-icon', uri),
  getIconForItem: (filePath: string, itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri') =>
    ipcRenderer.invoke('get-icon-for-item', filePath, itemType),
  loadCachedIcons: (items: LauncherItem[]) => ipcRenderer.invoke('load-cached-icons', items),
  // 統合進捗付きアイコン取得API
  fetchIconsCombined: (urlItems: LauncherItem[], items: LauncherItem[]) =>
    ipcRenderer.invoke('fetch-icons-combined', urlItems, items),
  // 進捗イベントリスナー
  onIconProgress: (
    eventType: 'start' | 'update' | 'complete',
    callback: (data: IconProgress) => void
  ) => {
    ipcRenderer.on(`icon-progress-${eventType}`, (_event, data) => callback(data));
  },
  onWindowShown: (callback: (startTime?: number) => void) => {
    const listener = (_event: unknown, startTime?: number) => callback(startTime);
    ipcRenderer.on('window-shown', listener);
    return () => {
      ipcRenderer.removeListener('window-shown', listener);
    };
  },
  onWindowHidden: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('window-hidden', listener);
    return () => {
      ipcRenderer.removeListener('window-hidden', listener);
    };
  },
  onSetActiveTab: (callback: (tab: 'settings' | 'edit' | 'archive' | 'other') => void) => {
    ipcRenderer.on('set-active-tab', (_event, tab) => callback(tab));
  },
  onDataChanged: (callback: () => void) => {
    ipcRenderer.on('data-changed', callback);
    return () => {
      ipcRenderer.removeListener('data-changed', callback);
    };
  },
  onSettingsChanged: (callback: () => void) => {
    ipcRenderer.on('settings-changed', callback);
    return () => {
      ipcRenderer.removeListener('settings-changed', callback);
    };
  },
  onWorkspaceChanged: (callback: () => void) => {
    ipcRenderer.on('workspace-changed', callback);
    return () => {
      ipcRenderer.removeListener('workspace-changed', callback);
    };
  },
  // 3段階ピンモードAPI
  getWindowPinMode: (): Promise<WindowPinMode> => ipcRenderer.invoke('get-window-pin-mode'),
  cycleWindowPinMode: () => ipcRenderer.invoke('cycle-window-pin-mode'),
  registerItems: (items: RegisterItem[]) => ipcRenderer.invoke('register-items', items),
  isDirectory: (filePath: string) => ipcRenderer.invoke('is-directory', filePath),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  getAllWindows: (): Promise<WindowInfo[]> => ipcRenderer.invoke('get-all-windows'),
  updateItem: (request: UpdateItemRequest) => ipcRenderer.invoke('update-item', request),
  updateRawLine: (request: { sourceFile: string; lineNumber: number; newContent: string }) =>
    ipcRenderer.invoke('update-raw-line', request),
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
  // ブラウザブックマーク直接インポートAPI
  detectInstalledBrowsers: (): Promise<BrowserInfo[]> =>
    ipcRenderer.invoke('detect-installed-browsers'),
  parseBrowserBookmarks: (filePath: string) =>
    ipcRenderer.invoke('parse-browser-bookmarks', filePath),
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
  isFirstLaunch: () => ipcRenderer.invoke('settings:is-first-launch'),
  // 編集ウィンドウ関連API
  showEditWindow: () => ipcRenderer.invoke('show-edit-window'),
  hideEditWindow: () => ipcRenderer.invoke('hide-edit-window'),
  toggleEditWindow: () => ipcRenderer.invoke('toggle-edit-window'),
  isEditWindowShown: () => ipcRenderer.invoke('is-edit-window-shown'),
  openEditWindowWithTab: (tab: 'settings' | 'edit' | 'other') =>
    ipcRenderer.invoke('open-edit-window-with-tab', tab),
  getInitialTab: () => ipcRenderer.invoke('get-initial-tab'),
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  setModalMode: (isModal: boolean, requiredSize?: { width: number; height: number }) =>
    ipcRenderer.invoke('set-modal-mode', isModal, requiredSize),
  // パフォーマンス計測API
  logPerformanceTiming: (label: string, duration: number) =>
    ipcRenderer.invoke('log-performance-timing', label, duration),
  // スプラッシュスクリーン関連API
  splashReady: () => ipcRenderer.invoke('splash-ready'),
  // カスタムアイコン関連API
  selectCustomIconFile: () => ipcRenderer.invoke('select-custom-icon-file'),
  saveCustomIcon: (sourceFilePath: string, itemIdentifier: string) =>
    ipcRenderer.invoke('save-custom-icon', sourceFilePath, itemIdentifier),
  deleteCustomIcon: (customIconFileName: string) =>
    ipcRenderer.invoke('delete-custom-icon', customIconFileName),
  getCustomIcon: (customIconFileName: string) =>
    ipcRenderer.invoke('get-custom-icon', customIconFileName),
  // 検索履歴関連API
  loadSearchHistory: () => ipcRenderer.invoke('load-search-history'),
  saveSearchHistory: (entries: SearchHistoryEntry[]) =>
    ipcRenderer.invoke('save-search-history', entries),
  addSearchHistoryEntry: (query: string) => ipcRenderer.invoke('add-search-history-entry', query),
  clearSearchHistory: () => ipcRenderer.invoke('clear-search-history'),
  // アプリ情報関連API
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('get-app-info'),
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
  // ウィンドウ検索API
  getWindowList: (): Promise<WindowInfo[]> => ipcRenderer.invoke('get-all-windows'),
  activateWindowByHwnd: (hwnd: number | bigint): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('activate-window', hwnd),
  // ワークスペースウィンドウ制御API
  toggleWorkspaceWindow: () => ipcRenderer.invoke('workspace:toggle-window'),
  showWorkspaceWindow: () => ipcRenderer.invoke('workspace:show-window'),
  hideWorkspaceWindow: () => ipcRenderer.invoke('workspace:hide-window'),
  // ワークスペース関連API
  workspaceAPI: {
    loadItems: (): Promise<WorkspaceItem[]> => ipcRenderer.invoke('workspace:load-items'),
    addItem: (item: AppItem, groupId?: string): Promise<WorkspaceItem> =>
      ipcRenderer.invoke('workspace:add-item', item, groupId),
    addItemsFromPaths: (filePaths: string[], groupId?: string): Promise<WorkspaceItem[]> =>
      ipcRenderer.invoke('workspace:add-items-from-paths', filePaths, groupId),
    removeItem: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:remove-item', id),
    updateDisplayName: (id: string, displayName: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:update-display-name', id, displayName),
    reorderItems: (itemIds: string[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:reorder-items', itemIds),
    launchItem: (item: WorkspaceItem): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:launch-item', item),
    // グループ管理
    loadGroups: (): Promise<WorkspaceGroup[]> => ipcRenderer.invoke('workspace:load-groups'),
    createGroup: (name: string, color?: string): Promise<WorkspaceGroup> =>
      ipcRenderer.invoke('workspace:create-group', name, color),
    updateGroup: (id: string, updates: Partial<WorkspaceGroup>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:update-group', id, updates),
    deleteGroup: (id: string, deleteItems: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:delete-group', id, deleteItems),
    reorderGroups: (groupIds: string[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:reorder-groups', groupIds),
    moveItemToGroup: (itemId: string, groupId?: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:move-item-to-group', itemId, groupId),
    // アーカイブ管理
    archiveGroup: (groupId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:archive-group', groupId),
    loadArchivedGroups: (): Promise<WorkspaceGroup[]> =>
      ipcRenderer.invoke('workspace:load-archived-groups'),
    restoreGroup: (groupId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:restore-group', groupId),
    deleteArchivedGroup: (groupId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:delete-archived-group', groupId),
    // 実行履歴
    loadExecutionHistory: (): Promise<ExecutionHistoryItem[]> =>
      ipcRenderer.invoke('workspace:load-execution-history'),
    addExecutionHistory: (item: AppItem): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:add-execution-history', item),
    clearExecutionHistory: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('workspace:clear-execution-history'),
    // ピン留め関連
    getAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('workspace:get-always-on-top'),
    toggleAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('workspace:toggle-always-on-top'),
    // モーダルモード関連
    setModalMode: (isModal: boolean, requiredSize?: { width: number; height: number }) =>
      ipcRenderer.invoke('workspace:set-modal-mode', isModal, requiredSize),
    // 透過度関連
    setOpacity: (opacityPercent: number): Promise<boolean> =>
      ipcRenderer.invoke('workspace:set-opacity', opacityPercent),
    getOpacity: (): Promise<number> => ipcRenderer.invoke('workspace:get-opacity'),
    // サイズ変更関連
    setSize: (width: number, height: number): Promise<boolean> =>
      ipcRenderer.invoke('workspace:set-size', width, height),
    setPositionAndSize: (x: number, y: number, width: number, height: number): Promise<boolean> =>
      ipcRenderer.invoke('workspace:set-position-and-size', x, y, width, height),
    // ウィンドウ制御
    hideWindow: (): Promise<boolean> => ipcRenderer.invoke('workspace:hide-window'),
  },
});
