import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  LauncherItem,
  AppSettings,
  IconProgress,
  WindowPinMode,
  SearchHistoryEntry,
  GroupItem,
  WindowItem,
  AppItem,
  AppInfo,
  BrowserInfo,
  WorkspaceItem,
  WorkspaceGroup,
  ExecutionHistoryItem,
  WindowInfo,
  VirtualDesktopInfo,
  IconFetchErrorRecord,
  JsonDirOptions,
  ClipboardCaptureResult,
  ClipboardRestoreResult,
  ClipboardPreview,
  CurrentClipboardState,
  DisplayInfo,
  ClipboardSessionCaptureResult,
  ClipboardSessionCommitResult,
} from '@common/types';
import type { EditableJsonItem, LoadEditableItemsResult } from '@common/types/editableItem';
import { IPC_CHANNELS } from '@common/ipcChannels';

// イベントリスナー登録のヘルパー関数
function createEventListener<T>(channel: string, callback: (data: T) => void): () => void {
  const listener = (_event: unknown, data: T) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

function createEventListenerNoArg(channel: string, callback: () => void): () => void {
  const listener = () => callback();
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

interface RegisterItem {
  filePath: string;
  displayName: string;
  itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  fullArgs?: string;
}

interface UpdateItemByIdRequest {
  id: string;
  newItem: LauncherItem;
}

interface DeleteItemByIdRequest {
  id: string;
}

contextBridge.exposeInMainWorld('electronAPI', {
  getConfigFolder: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG_FOLDER),
  getDataFiles: (): Promise<string[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_DATA_FILES),
  createDataFile: (fileName: string) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_DATA_FILE, fileName),
  deleteDataFile: (fileName: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_DATA_FILE, fileName),
  loadDataFiles: (): Promise<AppItem[]> => ipcRenderer.invoke(IPC_CHANNELS.LOAD_DATA_FILES),
  openItem: (item: LauncherItem) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_ITEM, item),
  openParentFolder: (item: LauncherItem) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_PARENT_FOLDER, item),
  executeGroup: (group: GroupItem, allItems: AppItem[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXECUTE_GROUP, group, allItems),
  executeWindowOperation: (item: WindowItem): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXECUTE_WINDOW_OPERATION, item),
  openConfigFolder: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_CONFIG_FOLDER),
  fetchFavicon: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.FETCH_FAVICON, url),
  extractIcon: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.EXTRACT_ICON, filePath),
  extractFileIconByExtension: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXTRACT_FILE_ICON_BY_EXTENSION, filePath),
  extractCustomUriIcon: (uri: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXTRACT_CUSTOM_URI_ICON, uri),
  getIconForItem: (filePath: string, itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri') =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ICON_FOR_ITEM, filePath, itemType),
  loadCachedIcons: (items: LauncherItem[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOAD_CACHED_ICONS, items),
  // 統合進捗付きアイコン取得API
  fetchIconsCombined: (
    urlItems: LauncherItem[],
    items: LauncherItem[],
    forceRefresh: boolean = false
  ) => ipcRenderer.invoke(IPC_CHANNELS.FETCH_ICONS_COMBINED, urlItems, items, forceRefresh),
  // アイコン取得エラー記録をクリア
  clearIconFetchErrors: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_ICON_FETCH_ERRORS),
  // アイコン取得エラー記録を取得
  getIconFetchErrors: (): Promise<IconFetchErrorRecord[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ICON_FETCH_ERRORS),
  // 進捗イベントリスナー
  onIconProgress: (
    eventType: 'start' | 'update' | 'complete',
    callback: (data: IconProgress) => void
  ) => {
    const eventMap = {
      start: IPC_CHANNELS.EVENT_ICON_PROGRESS_START,
      update: IPC_CHANNELS.EVENT_ICON_PROGRESS_UPDATE,
      complete: IPC_CHANNELS.EVENT_ICON_PROGRESS_COMPLETE,
    };
    ipcRenderer.on(eventMap[eventType], (_event, data) => callback(data));
  },
  onWindowShown: (callback: (startTime?: number) => void) =>
    createEventListener<number | undefined>(IPC_CHANNELS.EVENT_WINDOW_SHOWN, callback),
  onWindowShownItemSearch: (callback: (startTime?: number) => void) =>
    createEventListener<number | undefined>(IPC_CHANNELS.EVENT_WINDOW_SHOWN_ITEM_SEARCH, callback),
  onWindowHidden: (callback: () => void) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_WINDOW_HIDDEN, callback),
  onSetActiveTab: (callback: (tab: 'settings' | 'edit' | 'archive' | 'other') => void) => {
    ipcRenderer.on(IPC_CHANNELS.EVENT_SET_ACTIVE_TAB, (_event, tab) => callback(tab));
  },
  onDataChanged: (callback: () => void) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_DATA_CHANGED, callback),
  onSettingsChanged: (callback: () => void) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, callback),
  onWorkspaceChanged: (callback: () => void) =>
    createEventListenerNoArg(IPC_CHANNELS.WORKSPACE_CHANGED, callback),
  // 3段階ピンモードAPI
  getWindowPinMode: (): Promise<WindowPinMode> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_WINDOW_PIN_MODE),
  cycleWindowPinMode: () => ipcRenderer.invoke(IPC_CHANNELS.CYCLE_WINDOW_PIN_MODE),
  registerItems: (items: RegisterItem[]) => ipcRenderer.invoke(IPC_CHANNELS.REGISTER_ITEMS, items),
  isDirectory: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.IS_DIRECTORY, filePath),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  quitApp: () => ipcRenderer.invoke(IPC_CHANNELS.QUIT_APP),
  getAllWindows: (): Promise<WindowInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_WINDOWS),
  getAllWindowsAllDesktops: (): Promise<WindowInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_WINDOWS_ALL_DESKTOPS),
  getVirtualDesktopInfo: (): Promise<VirtualDesktopInfo> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_VIRTUAL_DESKTOP_INFO),
  updateItemById: (request: UpdateItemByIdRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_ITEM_BY_ID, request),
  deleteItemsById: (requests: DeleteItemByIdRequest[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_ITEMS_BY_ID, requests),
  batchUpdateItemsById: (requests: UpdateItemByIdRequest[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.BATCH_UPDATE_ITEMS_BY_ID, requests),
  // EditableJsonItem API
  loadEditableItems: (): Promise<LoadEditableItemsResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.LOAD_EDITABLE_ITEMS),
  saveEditableItems: (editableItems: EditableJsonItem[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_EDITABLE_ITEMS, editableItems),
  // IDベースのアイテム更新
  updateDirItemById: (id: string, dirPath: string, options?: JsonDirOptions, memo?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DIR_ITEM_BY_ID, id, dirPath, options, memo),
  updateGroupItemById: (id: string, displayName: string, itemNames: string[], memo?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_GROUP_ITEM_BY_ID, id, displayName, itemNames, memo),
  updateWindowItemById: (
    id: string,
    config: {
      displayName: string;
      windowTitle: string;
      processName?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      moveToActiveMonitorCenter?: boolean;
      virtualDesktopNumber?: number;
      activateWindow?: boolean;
      pinToAllDesktops?: boolean;
    },
    memo?: string
  ) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_WINDOW_ITEM_BY_ID, id, config, memo),
  setEditMode: (editMode: boolean) => ipcRenderer.invoke(IPC_CHANNELS.SET_EDIT_MODE, editMode),
  getEditMode: () => ipcRenderer.invoke(IPC_CHANNELS.GET_EDIT_MODE),
  selectBookmarkFile: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_BOOKMARK_FILE),
  parseBookmarkFile: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PARSE_BOOKMARK_FILE, filePath),
  // ブラウザブックマーク直接インポートAPI
  detectInstalledBrowsers: (): Promise<BrowserInfo[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.DETECT_INSTALLED_BROWSERS),
  parseBrowserBookmarks: (filePath: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.PARSE_BROWSER_BOOKMARKS, filePath),
  // Settings API
  getSettings: (key?: keyof AppSettings) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
  setSetting: (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  setMultipleSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_MULTIPLE, settings),
  resetSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET),
  validateHotkey: (hotkey: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_VALIDATE_HOTKEY, hotkey),
  getSettingsConfigPath: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_CONFIG_PATH),
  changeHotkey: (newHotkey: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CHANGE_HOTKEY, newHotkey),
  checkHotkeyAvailability: (hotkey: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CHECK_HOTKEY_AVAILABILITY, hotkey),
  changeItemSearchHotkey: (newHotkey: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CHANGE_ITEM_SEARCH_HOTKEY, newHotkey),
  getDisplays: (): Promise<DisplayInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_DISPLAYS),
  isFirstLaunch: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_IS_FIRST_LAUNCH),
  // 編集ウィンドウ関連API
  showEditWindow: () => ipcRenderer.invoke(IPC_CHANNELS.SHOW_EDIT_WINDOW),
  hideEditWindow: () => ipcRenderer.invoke(IPC_CHANNELS.HIDE_EDIT_WINDOW),
  toggleEditWindow: () => ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_EDIT_WINDOW),
  isEditWindowShown: () => ipcRenderer.invoke(IPC_CHANNELS.IS_EDIT_WINDOW_SHOWN),
  openEditWindowWithTab: (tab: 'settings' | 'edit' | 'other') =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_EDIT_WINDOW_WITH_TAB, tab),
  getInitialTab: () => ipcRenderer.invoke(IPC_CHANNELS.GET_INITIAL_TAB),
  copyToClipboard: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.COPY_TO_CLIPBOARD, text),
  setModalMode: (isModal: boolean, requiredSize?: { width: number; height: number }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SET_MODAL_MODE, isModal, requiredSize),
  // パフォーマンス計測API
  logPerformanceTiming: (label: string, duration: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOG_PERFORMANCE_TIMING, label, duration),
  // スプラッシュスクリーン関連API
  splashReady: () => ipcRenderer.invoke(IPC_CHANNELS.SPLASH_READY),
  // カスタムアイコン関連API
  selectCustomIconFile: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_CUSTOM_ICON_FILE),
  saveCustomIcon: (sourceFilePath: string, itemIdentifier: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CUSTOM_ICON, sourceFilePath, itemIdentifier),
  deleteCustomIcon: (customIconFileName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_CUSTOM_ICON, customIconFileName),
  getCustomIcon: (customIconFileName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CUSTOM_ICON, customIconFileName),
  // 検索履歴関連API
  loadSearchHistory: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_SEARCH_HISTORY),
  saveSearchHistory: (entries: SearchHistoryEntry[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SEARCH_HISTORY, entries),
  addSearchHistoryEntry: (query: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_SEARCH_HISTORY_ENTRY, query),
  clearSearchHistory: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_SEARCH_HISTORY),
  // アプリ情報関連API
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_INFO),
  openExternalUrl: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL_URL, url),
  // ウィンドウ検索API
  getWindowList: (): Promise<WindowInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_WINDOWS),
  activateWindowByHwnd: (hwnd: number | bigint): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.ACTIVATE_WINDOW, hwnd),
  moveWindowToDesktop: (
    hwnd: number | bigint,
    desktopNumber: number
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.MOVE_WINDOW_TO_DESKTOP, hwnd, desktopNumber),
  pinWindow: (hwnd: number | bigint): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.PIN_WINDOW, hwnd),
  unPinWindow: (hwnd: number | bigint): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.UNPIN_WINDOW, hwnd),
  isWindowPinned: (hwnd: number | bigint): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.IS_WINDOW_PINNED, hwnd),
  closeWindow: (hwnd: number | bigint): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.CLOSE_WINDOW, hwnd),
  // システム通知API
  showNotification: (
    title: string,
    body: string,
    type?: 'success' | 'error' | 'info' | 'warning'
  ) => ipcRenderer.invoke(IPC_CHANNELS.SHOW_NOTIFICATION, { title, body, type }),
  // トーストウィンドウAPI（メインウィンドウが閉じた後も表示可能）
  showToastWindow: (
    options:
      | string
      | {
          message?: string;
          type?: 'success' | 'error' | 'info' | 'warning';
          duration?: number;
          itemType?: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'group' | 'windowOperation';
          displayName?: string;
          path?: string;
          icon?: string;
          itemCount?: number;
          itemNames?: string[];
        },
    type?: 'success' | 'error' | 'info' | 'warning',
    duration?: number
  ) => {
    // 後方互換性のため文字列形式もサポート
    if (typeof options === 'string') {
      return ipcRenderer.invoke(IPC_CHANNELS.SHOW_TOAST_WINDOW, {
        message: options,
        type,
        duration,
      });
    }
    return ipcRenderer.invoke(IPC_CHANNELS.SHOW_TOAST_WINDOW, options);
  },
  // トーストウィンドウ用イベントリスナー（toast.html用）
  onShowToast: (
    callback: (data: {
      message?: string;
      type: string;
      duration: number;
      itemType?: string;
      displayName?: string;
      path?: string;
      icon?: string;
      itemCount?: number;
      itemNames?: string[];
    }) => void
  ) => {
    ipcRenderer.on(IPC_CHANNELS.EVENT_SHOW_TOAST, (_event, data) => callback(data));
  },
  // ワークスペースウィンドウ制御API
  toggleWorkspaceWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_TOGGLE_WINDOW),
  showWorkspaceWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SHOW_WINDOW),
  hideWorkspaceWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_HIDE_WINDOW),
  // ワークスペース関連API
  workspaceAPI: {
    loadItems: (): Promise<WorkspaceItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LOAD_ITEMS),
    addItem: (item: AppItem, groupId?: string): Promise<WorkspaceItem> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ADD_ITEM, item, groupId),
    addItemsFromPaths: (filePaths: string[], groupId?: string): Promise<WorkspaceItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ADD_ITEMS_FROM_PATHS, filePaths, groupId),
    removeItem: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_REMOVE_ITEM, id),
    updateDisplayName: (id: string, displayName: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_UPDATE_DISPLAY_NAME, id, displayName),
    updateItem: (id: string, updates: Partial<WorkspaceItem>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_UPDATE_ITEM, id, updates),
    reorderItems: (itemIds: string[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_REORDER_ITEMS, itemIds),
    launchItem: (item: WorkspaceItem): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LAUNCH_ITEM, item),
    // グループ管理
    loadGroups: (): Promise<WorkspaceGroup[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LOAD_GROUPS),
    createGroup: (name: string, color?: string): Promise<WorkspaceGroup> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_CREATE_GROUP, name, color),
    updateGroup: (id: string, updates: Partial<WorkspaceGroup>): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_UPDATE_GROUP, id, updates),
    deleteGroup: (id: string, deleteItems: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DELETE_GROUP, id, deleteItems),
    reorderGroups: (groupIds: string[]): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_REORDER_GROUPS, groupIds),
    moveItemToGroup: (itemId: string, groupId?: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_MOVE_ITEM_TO_GROUP, itemId, groupId),
    // アーカイブ管理
    archiveGroup: (groupId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ARCHIVE_GROUP, groupId),
    loadArchivedGroups: (): Promise<WorkspaceGroup[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LOAD_ARCHIVED_GROUPS),
    restoreGroup: (groupId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_RESTORE_GROUP, groupId),
    deleteArchivedGroup: (groupId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DELETE_ARCHIVED_GROUP, groupId),
    // 実行履歴
    loadExecutionHistory: (): Promise<ExecutionHistoryItem[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LOAD_EXECUTION_HISTORY),
    addExecutionHistory: (item: AppItem): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ADD_EXECUTION_HISTORY, item),
    clearExecutionHistory: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_CLEAR_EXECUTION_HISTORY),
    // ピン留め関連
    getAlwaysOnTop: (): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_ALWAYS_ON_TOP),
    toggleAlwaysOnTop: (): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_TOGGLE_ALWAYS_ON_TOP),
    // モーダルモード関連
    setModalMode: (isModal: boolean, requiredSize?: { width: number; height: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET_MODAL_MODE, isModal, requiredSize),
    // 透過度関連
    setOpacity: (opacityPercent: number): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET_OPACITY, opacityPercent),
    getOpacity: (): Promise<number> => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_OPACITY),
    // サイズ変更関連
    setSize: (width: number, height: number): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET_SIZE, width, height),
    setPositionAndSize: (x: number, y: number, width: number, height: number): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET_POSITION_AND_SIZE, x, y, width, height),
    // 位置モード設定（primaryLeft: 左端、primaryRight: 右端）
    setPositionMode: (mode: 'primaryLeft' | 'primaryRight'): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET_POSITION_MODE, mode),
    // ウィンドウ制御
    hideWindow: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_HIDE_WINDOW),
  },
  // コンテキストメニュー表示API
  showAdminItemContextMenu: (selectedCount: number, isSingleLine: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_ADMIN_ITEM_CONTEXT_MENU, selectedCount, isSingleLine),
  // AdminItemManagerContextMenuイベントリスナー
  onAdminMenuDuplicateItems: (callback: () => void) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_ADMIN_MENU_DUPLICATE_ITEMS, callback),
  onAdminMenuEditItem: (callback: () => void) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_ADMIN_MENU_EDIT_ITEM, callback),
  onAdminMenuDeleteItems: (callback: () => void) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_ADMIN_MENU_DELETE_ITEMS, callback),
  // LauncherContextMenu
  showLauncherContextMenu: (item: AppItem): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_LAUNCHER_CONTEXT_MENU, item),
  onLauncherMenuEditItem: (callback: (item: AppItem) => void) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_EDIT_ITEM, callback),
  onLauncherMenuAddToWorkspace: (callback: (item: AppItem) => void) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_ADD_TO_WORKSPACE, callback),
  onLauncherMenuCopyPath: (callback: (item: AppItem) => void) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PATH, callback),
  onLauncherMenuCopyParentPath: (callback: (item: AppItem) => void) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PARENT_PATH, callback),
  onLauncherMenuOpenParentFolder: (callback: (item: AppItem) => void) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_PARENT_FOLDER, callback),
  onLauncherMenuCopyShortcutPath: (callback: (item: AppItem) => void) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PATH, callback),
  onLauncherMenuCopyShortcutParentPath: (callback: (item: AppItem) => void) =>
    createEventListener<AppItem>(
      IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PARENT_PATH,
      callback
    ),
  onLauncherMenuOpenShortcutParentFolder: (callback: (item: AppItem) => void) =>
    createEventListener<AppItem>(
      IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
      callback
    ),
  // WindowContextMenu
  showWindowContextMenu: (
    windowInfo: WindowInfo,
    desktopInfo: VirtualDesktopInfo,
    isPinned: boolean
  ): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_WINDOW_CONTEXT_MENU, windowInfo, desktopInfo, isPinned),
  onWindowMenuActivate: (callback: (windowInfo: WindowInfo) => void) =>
    createEventListener<WindowInfo>(IPC_CHANNELS.EVENT_WINDOW_MENU_ACTIVATE, callback),
  onMoveWindowToDesktop: (callback: (hwnd: number | bigint, desktopNumber: number) => void) => {
    const listener = (_event: unknown, hwnd: number | bigint, desktopNumber: number) =>
      callback(hwnd, desktopNumber);
    ipcRenderer.on(IPC_CHANNELS.MOVE_WINDOW_TO_DESKTOP, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.MOVE_WINDOW_TO_DESKTOP, listener);
  },
  onPinWindow: (callback: (hwnd: number | bigint) => void) =>
    createEventListener<number | bigint>(IPC_CHANNELS.PIN_WINDOW, callback),
  onUnPinWindow: (callback: (hwnd: number | bigint) => void) =>
    createEventListener<number | bigint>(IPC_CHANNELS.UNPIN_WINDOW, callback),
  // WorkspaceContextMenu
  showWorkspaceContextMenu: (item: WorkspaceItem, groups: WorkspaceGroup[]): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_WORKSPACE_CONTEXT_MENU, item, groups),
  onWorkspaceMenuRenameItem: (callback: (itemId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_RENAME_ITEM, callback),
  onWorkspaceMenuEditItem: (callback: (itemId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_EDIT_ITEM, callback),
  onWorkspaceMenuLaunchItem: (callback: (itemId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_LAUNCH_ITEM, callback),
  onWorkspaceMenuCopyPath: (callback: (itemId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_PATH, callback),
  onWorkspaceMenuCopyParentPath: (callback: (itemId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_PARENT_PATH, callback),
  onWorkspaceMenuOpenParentFolder: (callback: (itemId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_OPEN_PARENT_FOLDER, callback),
  onWorkspaceMenuCopyShortcutPath: (callback: (itemId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PATH, callback),
  onWorkspaceMenuCopyShortcutParentPath: (callback: (itemId: string) => void) =>
    createEventListener<string>(
      IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PARENT_PATH,
      callback
    ),
  onWorkspaceMenuOpenShortcutParentFolder: (callback: (itemId: string) => void) =>
    createEventListener<string>(
      IPC_CHANNELS.EVENT_WORKSPACE_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
      callback
    ),
  onWorkspaceMenuRemoveFromGroup: (callback: (itemId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_REMOVE_FROM_GROUP, callback),
  onWorkspaceMenuRemoveItem: (callback: (itemId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_REMOVE_ITEM, callback),
  // WorkspaceGroupContextMenu
  showWorkspaceGroupContextMenu: (group: WorkspaceGroup): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_WORKSPACE_GROUP_CONTEXT_MENU, group),
  onWorkspaceGroupMenuRename: (callback: (groupId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_RENAME, callback),
  onWorkspaceGroupMenuShowColorPicker: (callback: (groupId: string) => void) =>
    createEventListener<string>(
      IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_SHOW_COLOR_PICKER,
      callback
    ),
  onWorkspaceGroupMenuChangeColor: (callback: (groupId: string, color: string) => void) => {
    const listener = (_event: unknown, groupId: string, color: string) => callback(groupId, color);
    ipcRenderer.on(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_CHANGE_COLOR, listener);
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_CHANGE_COLOR, listener);
  },
  onWorkspaceGroupMenuCopyAsText: (callback: (groupId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_COPY_AS_TEXT, callback),
  onWorkspaceGroupMenuArchive: (callback: (groupId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ARCHIVE, callback),
  onWorkspaceGroupMenuDelete: (callback: (groupId: string) => void) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_DELETE, callback),
  // クリップボード関連API
  clipboardAPI: {
    checkCurrent: (): Promise<CurrentClipboardState> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_CHECK_CURRENT),
    capture: (): Promise<ClipboardCaptureResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_CAPTURE),
    restore: (dataFileRef: string): Promise<ClipboardRestoreResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_RESTORE, dataFileRef),
    deleteData: (dataFileRef: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_DELETE_DATA, dataFileRef),
    getPreview: (dataFileRef: string): Promise<ClipboardPreview | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_GET_PREVIEW, dataFileRef),
    // セッション管理（登録確定前の一時保存）
    captureToSession: (): Promise<ClipboardSessionCaptureResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_CAPTURE_TO_SESSION),
    commitSession: (sessionId: string): Promise<ClipboardSessionCommitResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_COMMIT_SESSION, sessionId),
    discardSession: (sessionId: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_DISCARD_SESSION, sessionId),
  },
});
