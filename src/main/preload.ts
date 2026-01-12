import { contextBridge, ipcRenderer, webUtils } from 'electron';
import {
  LauncherItem,
  RawDataLine,
  AppSettings,
  IconProgress,
  WindowPinMode,
  SearchHistoryEntry,
  GroupItem,
  WindowOperationItem,
  AppItem,
  AppInfo,
  BrowserInfo,
  WorkspaceItem,
  WorkspaceGroup,
  ExecutionHistoryItem,
  WindowInfo,
} from '@common/types';
import {
  // データ操作
  GET_CONFIG_FOLDER,
  GET_DATA_FILES,
  CREATE_DATA_FILE,
  DELETE_DATA_FILE,
  LOAD_DATA_FILES,
  LOAD_RAW_DATA_FILES,
  SAVE_RAW_DATA_FILES,
  // アイテム操作
  OPEN_ITEM,
  OPEN_PARENT_FOLDER,
  EXECUTE_GROUP,
  EXECUTE_WINDOW_OPERATION,
  REGISTER_ITEMS,
  IS_DIRECTORY,
  // アイコン操作
  FETCH_FAVICON,
  EXTRACT_ICON,
  EXTRACT_FILE_ICON_BY_EXTENSION,
  EXTRACT_CUSTOM_URI_ICON,
  GET_ICON_FOR_ITEM,
  LOAD_CACHED_ICONS,
  FETCH_ICONS_COMBINED,
  SELECT_CUSTOM_ICON_FILE,
  SAVE_CUSTOM_ICON,
  DELETE_CUSTOM_ICON,
  GET_CUSTOM_ICON,
  // ウィンドウ操作
  SET_EDIT_MODE,
  GET_EDIT_MODE,
  SHOW_EDIT_WINDOW,
  HIDE_EDIT_WINDOW,
  TOGGLE_EDIT_WINDOW,
  IS_EDIT_WINDOW_SHOWN,
  OPEN_EDIT_WINDOW_WITH_TAB,
  GET_INITIAL_TAB,
  GET_WINDOW_PIN_MODE,
  CYCLE_WINDOW_PIN_MODE,
  GET_ALL_WINDOWS,
  ACTIVATE_WINDOW,
  COPY_TO_CLIPBOARD,
  SET_MODAL_MODE,
  QUIT_APP,
  // 設定操作
  SETTINGS_GET,
  SETTINGS_SET,
  SETTINGS_SET_MULTIPLE,
  SETTINGS_RESET,
  SETTINGS_VALIDATE_HOTKEY,
  SETTINGS_GET_CONFIG_PATH,
  SETTINGS_CHANGE_HOTKEY,
  SETTINGS_CHECK_HOTKEY_AVAILABILITY,
  SETTINGS_IS_FIRST_LAUNCH,
  OPEN_CONFIG_FOLDER,
  GET_APP_INFO,
  OPEN_EXTERNAL_URL,
  // ブックマーク操作
  SELECT_BOOKMARK_FILE,
  PARSE_BOOKMARK_FILE,
  DETECT_INSTALLED_BROWSERS,
  PARSE_BROWSER_BOOKMARKS,
  // 検索履歴
  LOAD_SEARCH_HISTORY,
  SAVE_SEARCH_HISTORY,
  ADD_SEARCH_HISTORY_ENTRY,
  CLEAR_SEARCH_HISTORY,
  // 編集操作
  UPDATE_ITEM,
  UPDATE_RAW_LINE,
  DELETE_ITEMS,
  BATCH_UPDATE_ITEMS,
  // パフォーマンス
  LOG_PERFORMANCE_TIMING,
  // システム通知
  SHOW_NOTIFICATION,
  // スプラッシュ
  SPLASH_READY,
  // イベント
  EVENT_WINDOW_SHOWN,
  EVENT_WINDOW_HIDDEN,
  EVENT_DATA_CHANGED,
  EVENT_SETTINGS_CHANGED,
  EVENT_SET_ACTIVE_TAB,
  EVENT_ICON_PROGRESS_START,
  EVENT_ICON_PROGRESS_UPDATE,
  EVENT_ICON_PROGRESS_COMPLETE,
  // ワークスペース
  WORKSPACE_TOGGLE_WINDOW,
  WORKSPACE_SHOW_WINDOW,
  WORKSPACE_HIDE_WINDOW,
  WORKSPACE_CHANGED,
  WORKSPACE_LOAD_ITEMS,
  WORKSPACE_ADD_ITEM,
  WORKSPACE_ADD_ITEMS_FROM_PATHS,
  WORKSPACE_REMOVE_ITEM,
  WORKSPACE_UPDATE_DISPLAY_NAME,
  WORKSPACE_REORDER_ITEMS,
  WORKSPACE_LAUNCH_ITEM,
  WORKSPACE_LOAD_GROUPS,
  WORKSPACE_CREATE_GROUP,
  WORKSPACE_UPDATE_GROUP,
  WORKSPACE_DELETE_GROUP,
  WORKSPACE_REORDER_GROUPS,
  WORKSPACE_MOVE_ITEM_TO_GROUP,
  WORKSPACE_ARCHIVE_GROUP,
  WORKSPACE_LOAD_ARCHIVED_GROUPS,
  WORKSPACE_RESTORE_GROUP,
  WORKSPACE_DELETE_ARCHIVED_GROUP,
  WORKSPACE_LOAD_EXECUTION_HISTORY,
  WORKSPACE_ADD_EXECUTION_HISTORY,
  WORKSPACE_CLEAR_EXECUTION_HISTORY,
  WORKSPACE_GET_ALWAYS_ON_TOP,
  WORKSPACE_TOGGLE_ALWAYS_ON_TOP,
  WORKSPACE_SET_MODAL_MODE,
  WORKSPACE_SET_OPACITY,
  WORKSPACE_GET_OPACITY,
  WORKSPACE_SET_SIZE,
  WORKSPACE_SET_POSITION_AND_SIZE,
} from '@common/ipcChannels.js';

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
  getConfigFolder: () => ipcRenderer.invoke(GET_CONFIG_FOLDER),
  getDataFiles: (): Promise<string[]> => ipcRenderer.invoke(GET_DATA_FILES),
  createDataFile: (fileName: string) => ipcRenderer.invoke(CREATE_DATA_FILE, fileName),
  deleteDataFile: (fileName: string) => ipcRenderer.invoke(DELETE_DATA_FILE, fileName),
  loadDataFiles: (): Promise<AppItem[]> => ipcRenderer.invoke(LOAD_DATA_FILES),
  openItem: (item: LauncherItem) => ipcRenderer.invoke(OPEN_ITEM, item),
  openParentFolder: (item: LauncherItem) => ipcRenderer.invoke(OPEN_PARENT_FOLDER, item),
  executeGroup: (group: GroupItem, allItems: AppItem[]) =>
    ipcRenderer.invoke(EXECUTE_GROUP, group, allItems),
  executeWindowOperation: (item: WindowOperationItem): Promise<void> =>
    ipcRenderer.invoke(EXECUTE_WINDOW_OPERATION, item),
  openConfigFolder: () => ipcRenderer.invoke(OPEN_CONFIG_FOLDER),
  fetchFavicon: (url: string) => ipcRenderer.invoke(FETCH_FAVICON, url),
  extractIcon: (filePath: string) => ipcRenderer.invoke(EXTRACT_ICON, filePath),
  extractFileIconByExtension: (filePath: string) =>
    ipcRenderer.invoke(EXTRACT_FILE_ICON_BY_EXTENSION, filePath),
  extractCustomUriIcon: (uri: string) => ipcRenderer.invoke(EXTRACT_CUSTOM_URI_ICON, uri),
  getIconForItem: (filePath: string, itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri') =>
    ipcRenderer.invoke(GET_ICON_FOR_ITEM, filePath, itemType),
  loadCachedIcons: (items: LauncherItem[]) => ipcRenderer.invoke(LOAD_CACHED_ICONS, items),
  // 統合進捗付きアイコン取得API
  fetchIconsCombined: (urlItems: LauncherItem[], items: LauncherItem[]) =>
    ipcRenderer.invoke(FETCH_ICONS_COMBINED, urlItems, items),
  // 進捗イベントリスナー
  onIconProgress: (
    eventType: 'start' | 'update' | 'complete',
    callback: (data: IconProgress) => void
  ) => {
    const eventMap = {
      start: EVENT_ICON_PROGRESS_START,
      update: EVENT_ICON_PROGRESS_UPDATE,
      complete: EVENT_ICON_PROGRESS_COMPLETE,
    };
    ipcRenderer.on(eventMap[eventType], (_event, data) => callback(data));
  },
  onWindowShown: (callback: (startTime?: number) => void) => {
    const listener = (_event: unknown, startTime?: number) => callback(startTime);
    ipcRenderer.on(EVENT_WINDOW_SHOWN, listener);
    return () => {
      ipcRenderer.removeListener(EVENT_WINDOW_SHOWN, listener);
    };
  },
  onWindowHidden: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(EVENT_WINDOW_HIDDEN, listener);
    return () => {
      ipcRenderer.removeListener(EVENT_WINDOW_HIDDEN, listener);
    };
  },
  onSetActiveTab: (callback: (tab: 'settings' | 'edit' | 'archive' | 'other') => void) => {
    ipcRenderer.on(EVENT_SET_ACTIVE_TAB, (_event, tab) => callback(tab));
  },
  onDataChanged: (callback: () => void) => {
    ipcRenderer.on(EVENT_DATA_CHANGED, callback);
    return () => {
      ipcRenderer.removeListener(EVENT_DATA_CHANGED, callback);
    };
  },
  onSettingsChanged: (callback: () => void) => {
    ipcRenderer.on(EVENT_SETTINGS_CHANGED, callback);
    return () => {
      ipcRenderer.removeListener(EVENT_SETTINGS_CHANGED, callback);
    };
  },
  onWorkspaceChanged: (callback: () => void) => {
    ipcRenderer.on(WORKSPACE_CHANGED, callback);
    return () => {
      ipcRenderer.removeListener(WORKSPACE_CHANGED, callback);
    };
  },
  // 3段階ピンモードAPI
  getWindowPinMode: (): Promise<WindowPinMode> => ipcRenderer.invoke(GET_WINDOW_PIN_MODE),
  cycleWindowPinMode: () => ipcRenderer.invoke(CYCLE_WINDOW_PIN_MODE),
  registerItems: (items: RegisterItem[]) => ipcRenderer.invoke(REGISTER_ITEMS, items),
  isDirectory: (filePath: string) => ipcRenderer.invoke(IS_DIRECTORY, filePath),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  quitApp: () => ipcRenderer.invoke(QUIT_APP),
  getAllWindows: (): Promise<WindowInfo[]> => ipcRenderer.invoke(GET_ALL_WINDOWS),
  updateItem: (request: UpdateItemRequest) => ipcRenderer.invoke(UPDATE_ITEM, request),
  updateRawLine: (request: { sourceFile: string; lineNumber: number; newContent: string }) =>
    ipcRenderer.invoke(UPDATE_RAW_LINE, request),
  deleteItems: (requests: DeleteItemRequest[]) => ipcRenderer.invoke(DELETE_ITEMS, requests),
  batchUpdateItems: (requests: UpdateItemRequest[]) =>
    ipcRenderer.invoke(BATCH_UPDATE_ITEMS, requests),
  loadRawDataFiles: () => ipcRenderer.invoke(LOAD_RAW_DATA_FILES),
  saveRawDataFiles: (rawLines: RawDataLine[]) => ipcRenderer.invoke(SAVE_RAW_DATA_FILES, rawLines),
  setEditMode: (editMode: boolean) => ipcRenderer.invoke(SET_EDIT_MODE, editMode),
  getEditMode: () => ipcRenderer.invoke(GET_EDIT_MODE),
  selectBookmarkFile: () => ipcRenderer.invoke(SELECT_BOOKMARK_FILE),
  parseBookmarkFile: (filePath: string) => ipcRenderer.invoke(PARSE_BOOKMARK_FILE, filePath),
  // ブラウザブックマーク直接インポートAPI
  detectInstalledBrowsers: (): Promise<BrowserInfo[]> =>
    ipcRenderer.invoke(DETECT_INSTALLED_BROWSERS),
  parseBrowserBookmarks: (filePath: string) =>
    ipcRenderer.invoke(PARSE_BROWSER_BOOKMARKS, filePath),
  // Settings API
  getSettings: (key?: keyof AppSettings) => ipcRenderer.invoke(SETTINGS_GET, key),
  setSetting: (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) =>
    ipcRenderer.invoke(SETTINGS_SET, key, value),
  setMultipleSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke(SETTINGS_SET_MULTIPLE, settings),
  resetSettings: () => ipcRenderer.invoke(SETTINGS_RESET),
  validateHotkey: (hotkey: string) => ipcRenderer.invoke(SETTINGS_VALIDATE_HOTKEY, hotkey),
  getSettingsConfigPath: () => ipcRenderer.invoke(SETTINGS_GET_CONFIG_PATH),
  changeHotkey: (newHotkey: string) => ipcRenderer.invoke(SETTINGS_CHANGE_HOTKEY, newHotkey),
  checkHotkeyAvailability: (hotkey: string) =>
    ipcRenderer.invoke(SETTINGS_CHECK_HOTKEY_AVAILABILITY, hotkey),
  isFirstLaunch: () => ipcRenderer.invoke(SETTINGS_IS_FIRST_LAUNCH),
  // 編集ウィンドウ関連API
  showEditWindow: () => ipcRenderer.invoke(SHOW_EDIT_WINDOW),
  hideEditWindow: () => ipcRenderer.invoke(HIDE_EDIT_WINDOW),
  toggleEditWindow: () => ipcRenderer.invoke(TOGGLE_EDIT_WINDOW),
  isEditWindowShown: () => ipcRenderer.invoke(IS_EDIT_WINDOW_SHOWN),
  openEditWindowWithTab: (tab: 'settings' | 'edit' | 'other') =>
    ipcRenderer.invoke(OPEN_EDIT_WINDOW_WITH_TAB, tab),
  getInitialTab: () => ipcRenderer.invoke(GET_INITIAL_TAB),
  copyToClipboard: (text: string) => ipcRenderer.invoke(COPY_TO_CLIPBOARD, text),
  setModalMode: (isModal: boolean, requiredSize?: { width: number; height: number }) =>
    ipcRenderer.invoke(SET_MODAL_MODE, isModal, requiredSize),
  // パフォーマンス計測API
  logPerformanceTiming: (label: string, duration: number) =>
    ipcRenderer.invoke(LOG_PERFORMANCE_TIMING, label, duration),
  // スプラッシュスクリーン関連API
  splashReady: () => ipcRenderer.invoke(SPLASH_READY),
  // カスタムアイコン関連API
  selectCustomIconFile: () => ipcRenderer.invoke(SELECT_CUSTOM_ICON_FILE),
  saveCustomIcon: (sourceFilePath: string, itemIdentifier: string) =>
    ipcRenderer.invoke(SAVE_CUSTOM_ICON, sourceFilePath, itemIdentifier),
  deleteCustomIcon: (customIconFileName: string) =>
    ipcRenderer.invoke(DELETE_CUSTOM_ICON, customIconFileName),
  getCustomIcon: (customIconFileName: string) =>
    ipcRenderer.invoke(GET_CUSTOM_ICON, customIconFileName),
  // 検索履歴関連API
  loadSearchHistory: () => ipcRenderer.invoke(LOAD_SEARCH_HISTORY),
  saveSearchHistory: (entries: SearchHistoryEntry[]) =>
    ipcRenderer.invoke(SAVE_SEARCH_HISTORY, entries),
  addSearchHistoryEntry: (query: string) => ipcRenderer.invoke(ADD_SEARCH_HISTORY_ENTRY, query),
  clearSearchHistory: () => ipcRenderer.invoke(CLEAR_SEARCH_HISTORY),
  // アプリ情報関連API
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(GET_APP_INFO),
  openExternalUrl: (url: string) => ipcRenderer.invoke(OPEN_EXTERNAL_URL, url),
  // ウィンドウ検索API
  getWindowList: (): Promise<WindowInfo[]> => ipcRenderer.invoke(GET_ALL_WINDOWS),
  activateWindowByHwnd: (hwnd: number | bigint): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(ACTIVATE_WINDOW, hwnd),
  // システム通知API
  showNotification: (
    title: string,
    body: string,
    type?: 'success' | 'error' | 'info' | 'warning'
  ) => ipcRenderer.invoke(SHOW_NOTIFICATION, { title, body, type }),
  // ワークスペースウィンドウ制御API
  toggleWorkspaceWindow: () => ipcRenderer.invoke(WORKSPACE_TOGGLE_WINDOW),
  showWorkspaceWindow: () => ipcRenderer.invoke(WORKSPACE_SHOW_WINDOW),
  hideWorkspaceWindow: () => ipcRenderer.invoke(WORKSPACE_HIDE_WINDOW),
  // ワークスペース関連API
  workspaceAPI: {
    loadItems: (): Promise<WorkspaceItem[]> => ipcRenderer.invoke(WORKSPACE_LOAD_ITEMS),
    addItem: (item: AppItem, groupId?: string): Promise<WorkspaceItem> =>
      ipcRenderer.invoke(WORKSPACE_ADD_ITEM, item, groupId),
    addItemsFromPaths: (filePaths: string[], groupId?: string): Promise<WorkspaceItem[]> =>
      ipcRenderer.invoke(WORKSPACE_ADD_ITEMS_FROM_PATHS, filePaths, groupId),
    removeItem: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_REMOVE_ITEM, id),
    updateDisplayName: (id: string, displayName: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_UPDATE_DISPLAY_NAME, id, displayName),
    reorderItems: (itemIds: string[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_REORDER_ITEMS, itemIds),
    launchItem: (item: WorkspaceItem): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_LAUNCH_ITEM, item),
    // グループ管理
    loadGroups: (): Promise<WorkspaceGroup[]> => ipcRenderer.invoke(WORKSPACE_LOAD_GROUPS),
    createGroup: (name: string, color?: string): Promise<WorkspaceGroup> =>
      ipcRenderer.invoke(WORKSPACE_CREATE_GROUP, name, color),
    updateGroup: (id: string, updates: Partial<WorkspaceGroup>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_UPDATE_GROUP, id, updates),
    deleteGroup: (id: string, deleteItems: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_DELETE_GROUP, id, deleteItems),
    reorderGroups: (groupIds: string[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_REORDER_GROUPS, groupIds),
    moveItemToGroup: (itemId: string, groupId?: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_MOVE_ITEM_TO_GROUP, itemId, groupId),
    // アーカイブ管理
    archiveGroup: (groupId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_ARCHIVE_GROUP, groupId),
    loadArchivedGroups: (): Promise<WorkspaceGroup[]> =>
      ipcRenderer.invoke(WORKSPACE_LOAD_ARCHIVED_GROUPS),
    restoreGroup: (groupId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_RESTORE_GROUP, groupId),
    deleteArchivedGroup: (groupId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_DELETE_ARCHIVED_GROUP, groupId),
    // 実行履歴
    loadExecutionHistory: (): Promise<ExecutionHistoryItem[]> =>
      ipcRenderer.invoke(WORKSPACE_LOAD_EXECUTION_HISTORY),
    addExecutionHistory: (item: AppItem): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_ADD_EXECUTION_HISTORY, item),
    clearExecutionHistory: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(WORKSPACE_CLEAR_EXECUTION_HISTORY),
    // ピン留め関連
    getAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke(WORKSPACE_GET_ALWAYS_ON_TOP),
    toggleAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke(WORKSPACE_TOGGLE_ALWAYS_ON_TOP),
    // モーダルモード関連
    setModalMode: (isModal: boolean, requiredSize?: { width: number; height: number }) =>
      ipcRenderer.invoke(WORKSPACE_SET_MODAL_MODE, isModal, requiredSize),
    // 透過度関連
    setOpacity: (opacityPercent: number): Promise<boolean> =>
      ipcRenderer.invoke(WORKSPACE_SET_OPACITY, opacityPercent),
    getOpacity: (): Promise<number> => ipcRenderer.invoke(WORKSPACE_GET_OPACITY),
    // サイズ変更関連
    setSize: (width: number, height: number): Promise<boolean> =>
      ipcRenderer.invoke(WORKSPACE_SET_SIZE, width, height),
    setPositionAndSize: (x: number, y: number, width: number, height: number): Promise<boolean> =>
      ipcRenderer.invoke(WORKSPACE_SET_POSITION_AND_SIZE, x, y, width, height),
    // ウィンドウ制御
    hideWindow: (): Promise<boolean> => ipcRenderer.invoke(WORKSPACE_HIDE_WINDOW),
  },
});
