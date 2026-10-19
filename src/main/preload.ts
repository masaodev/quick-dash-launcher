import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  PinLevel,
  IconProgress,
  LayoutExecutionProgress,
  AppItem,
  WindowInfo,
  MainChildWindowResult,
  WorkspaceItem,
  ToastEventData,
  AdminTab,
} from '@common/types';
import type { ElectronAPI } from '@common/types/electronApi';
import {
  IPC_CHANNELS,
  ICON_PROGRESS_CHANNELS,
  LAYOUT_PROGRESS_CHANNELS,
} from '@common/ipcChannels';

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

function createEventListener2<T1, T2>(
  channel: string,
  callback: (arg1: T1, arg2: T2) => void
): () => void {
  const listener = (_event: unknown, arg1: T1, arg2: T2) => callback(arg1, arg2);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

// 子ウィンドウの生成要求（メインプロセスからの指示で window.open を実行）
// レンダラーから開くことで子ウィンドウが開き元と同じレンダラープロセスを共有し、
// ウィンドウ1枚ごとの固定メモリ消費を抑える。生成後の管理はメインプロセス側で行う。
// 子ウィンドウを URL へナビゲーションさせると preload が適用されないため、
// about:blank で開いて対象 HTML を開き元から書き込む。
// 相対パスは開き元ドキュメントの URL を基準に解決される。
ipcRenderer.on(
  IPC_CHANNELS.WINDOW_OPEN_CHILD,
  (_event, payload: { html: string; name: string }) => {
    const child = window.open('about:blank', payload.name);
    if (!child) return;
    // document.write は非推奨扱いだが、about:blank の新規ウィンドウへ HTML 全体を
    // 書き込む用途では通常のページ読み込みと同じ順序でスクリプトが実行されるため採用する
    // （DOM 挿入だと module script が非同期実行になり、Vite の React Refresh 前処理と順序が崩れる）
    child.document.open();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    child.document.write(payload.html);
    child.document.close();
    ipcRenderer.send(IPC_CHANNELS.WINDOW_CHILD_WRITTEN, payload.name);
  }
);

const electronAPI: ElectronAPI = {
  getConfigFolder: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CONFIG_FOLDER),
  getDataFiles: () => ipcRenderer.invoke(IPC_CHANNELS.GET_DATA_FILES),
  createDataFile: (fileName) => ipcRenderer.invoke(IPC_CHANNELS.CREATE_DATA_FILE, fileName),
  deleteDataFile: (fileName) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_DATA_FILE, fileName),
  // trigger: 'full' は完全リフレッシュ、'internal' は変更通知・画面内の一覧取得（レポートは報告事項があるときだけ更新）
  loadDataFiles: (trigger) => ipcRenderer.invoke(IPC_CHANNELS.LOAD_DATA_FILES, trigger),
  openItem: (item) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_ITEM, item),
  openParentFolder: (item) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_PARENT_FOLDER, item),
  executeSet: (item, allItems) => ipcRenderer.invoke(IPC_CHANNELS.EXECUTE_SET, item, allItems),
  openConfigFolder: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_CONFIG_FOLDER),
  fetchFavicon: (url) => ipcRenderer.invoke(IPC_CHANNELS.FETCH_FAVICON, url),
  extractIcon: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.EXTRACT_ICON, filePath),
  getIconForItem: (filePath, itemType) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_ICON_FOR_ITEM, filePath, itemType),
  loadCachedIcons: (items) => ipcRenderer.invoke(IPC_CHANNELS.LOAD_CACHED_ICONS, items),
  // 統合進捗付きアイコン取得API
  fetchIconsCombined: (urlItems, items, forceRefresh = false, silent = false) =>
    ipcRenderer.invoke(IPC_CHANNELS.FETCH_ICONS_COMBINED, urlItems, items, forceRefresh, silent),
  // キャッシュ欠損の補完API（進捗通知なし）
  ensureIcons: (items) => ipcRenderer.invoke(IPC_CHANNELS.ENSURE_ICONS, items),
  // アイコン取得エラー記録をクリア
  // アイコン取得エラー記録を取得
  getIconFetchErrors: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ICON_FETCH_ERRORS),
  onIconProgress: (eventType, callback) =>
    createEventListener<IconProgress>(ICON_PROGRESS_CHANNELS[eventType], callback),
  onLayoutProgress: (eventType, callback) =>
    createEventListener<LayoutExecutionProgress>(LAYOUT_PROGRESS_CHANNELS[eventType], callback),
  cancelLayout: () => ipcRenderer.send(IPC_CHANNELS.LAYOUT_CANCEL),
  closeLayoutProgressWindow: () => ipcRenderer.send(IPC_CHANNELS.CLOSE_LAYOUT_PROGRESS_WINDOW),
  onWindowShown: (callback) =>
    createEventListener<number | undefined>(IPC_CHANNELS.EVENT_WINDOW_SHOWN, callback),
  onWindowShownItemSearch: (callback) =>
    createEventListener<number | undefined>(IPC_CHANNELS.EVENT_WINDOW_SHOWN_ITEM_SEARCH, callback),
  onWindowHidden: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_WINDOW_HIDDEN, callback),
  onFirstLaunchHotkeyPressed: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_FIRST_LAUNCH_HOTKEY_PRESSED, callback),
  onSetActiveTab: (callback) =>
    createEventListener<AdminTab>(IPC_CHANNELS.EVENT_SET_ACTIVE_TAB, callback),
  onAdminCloseRequested: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_ADMIN_CLOSE_REQUESTED, callback),
  onOpenImportModal: (callback) =>
    createEventListener<'bookmark' | 'app'>(IPC_CHANNELS.EVENT_OPEN_IMPORT_MODAL, callback),
  onDataChanged: (callback) => createEventListenerNoArg(IPC_CHANNELS.EVENT_DATA_CHANGED, callback),
  onSettingsChanged: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, callback),
  isWorkspaceOpen: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_IS_OPEN),
  onWorkspaceOpenChanged: (callback) =>
    createEventListener<boolean>(IPC_CHANNELS.EVENT_WORKSPACE_OPEN_CHANGED, callback),
  onWorkspaceRefitHeight: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_WORKSPACE_REFIT_HEIGHT, callback),
  onWorkspaceChanged: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.WORKSPACE_CHANGED, callback),
  pin: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.PIN_GET),
    set: (level) => ipcRenderer.invoke(IPC_CHANNELS.PIN_SET, level),
    showMenu: () => ipcRenderer.invoke(IPC_CHANNELS.PIN_SHOW_MENU),
    onChanged: (callback) =>
      createEventListener<PinLevel>(IPC_CHANNELS.EVENT_PIN_CHANGED, callback),
  },
  setEscapeHandledByPage: (handled) =>
    ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_ESCAPE_HANDLED_BY_PAGE, handled),
  startWindowMove: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_START_MOVE),
  registerItems: (items) => ipcRenderer.invoke(IPC_CHANNELS.REGISTER_ITEMS, items),
  getPathKind: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.PATH_GET_KIND, filePath),
  selectItemPath: (kind, currentPath) =>
    ipcRenderer.invoke(IPC_CHANNELS.PATH_SELECT, kind, currentPath),
  previewDirItems: (dirPath, options) =>
    ipcRenderer.invoke(IPC_CHANNELS.DIR_PREVIEW_RUN, dirPath, options),
  cancelDirPreview: () => ipcRenderer.invoke(IPC_CHANNELS.DIR_PREVIEW_CANCEL),
  getDefaultBrowser: () => ipcRenderer.invoke(IPC_CHANNELS.BROWSER_GET_DEFAULT),
  getFileHandler: (extension) => ipcRenderer.invoke(IPC_CHANNELS.FILE_GET_HANDLER, extension),
  checkPathsExist: (paths) => ipcRenderer.invoke(IPC_CHANNELS.CHECK_PATHS_EXIST, paths),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  quitApp: () => ipcRenderer.invoke(IPC_CHANNELS.QUIT_APP),
  getAllWindows: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_WINDOWS),
  getAllWindowsAllDesktops: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ALL_WINDOWS_ALL_DESKTOPS),
  getVirtualDesktopInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_VIRTUAL_DESKTOP_INFO),
  updateItemById: (request) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_ITEM_BY_ID, request),
  deleteItemsById: (requests) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_ITEMS_BY_ID, requests),
  // EditableJsonItem API
  loadEditableItems: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_EDITABLE_ITEMS),
  saveEditableItems: (editableItems, expectedHashes) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_EDITABLE_ITEMS, editableItems, expectedHashes),
  // IDベースのアイテム更新
  updateDirItemById: (id, dirPath, options, memo) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DIR_ITEM_BY_ID, id, dirPath, options, memo),
  updateSetItemById: (id, set, memo) =>
    ipcRenderer.invoke(IPC_CHANNELS.UPDATE_SET_ITEM_BY_ID, id, set, memo),
  selectBookmarkFile: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_BOOKMARK_FILE),
  parseBookmarkFileWithFolders: (filePath) =>
    ipcRenderer.invoke(IPC_CHANNELS.PARSE_BOOKMARK_FILE_WITH_FOLDERS, filePath),
  // ブラウザブックマーク直接インポートAPI
  detectInstalledBrowsers: () => ipcRenderer.invoke(IPC_CHANNELS.DETECT_INSTALLED_BROWSERS),
  // アプリインポートAPI
  scanInstalledApps: () => ipcRenderer.invoke(IPC_CHANNELS.SCAN_INSTALLED_APPS),
  // Settings API
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),
  setMultipleSettings: (settings) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_MULTIPLE, settings),
  resetSettings: (keys) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET, keys),
  reapplySettings: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_REAPPLY),
  validateHotkey: (hotkey) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_VALIDATE_HOTKEY, hotkey),
  changeHotkey: (newHotkey) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CHANGE_HOTKEY, newHotkey),
  changeItemSearchHotkey: (newHotkey) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_CHANGE_ITEM_SEARCH_HOTKEY, newHotkey),
  setHotkeyRecording: (recording) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_HOTKEY_RECORDING, recording),
  getDisplays: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_DISPLAYS),
  getScreenAreas: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SCREEN_AREAS),
  getAutoLaunchStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_AUTO_LAUNCH_STATUS),
  getLanguage: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_LANGUAGE),
  isFirstLaunch: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_IS_FIRST_LAUNCH),
  // 編集ウィンドウ関連API
  hideEditWindow: () => ipcRenderer.invoke(IPC_CHANNELS.HIDE_EDIT_WINDOW),
  toggleEditWindow: () => ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_EDIT_WINDOW),
  openEditWindowWithTab: (tab) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EDIT_WINDOW_WITH_TAB, tab),
  openEditWindowWithImportModal: (modal) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_EDIT_WINDOW_WITH_IMPORT_MODAL, modal),
  getInitialTab: () => ipcRenderer.invoke(IPC_CHANNELS.GET_INITIAL_TAB),
  getPendingImportModal: () => ipcRenderer.invoke(IPC_CHANNELS.GET_PENDING_IMPORT_MODAL),
  copyToClipboard: (text) => ipcRenderer.invoke(IPC_CHANNELS.COPY_TO_CLIPBOARD, text),
  // メイン画面の子ウィンドウ（アイテムの登録・編集、アイコン取得結果）
  openMainChildWindow: (request) =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_MAIN_CHILD_WINDOW, request),
  getMainChildWindowRequest: (requestId) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_MAIN_CHILD_WINDOW_REQUEST, requestId),
  notifyMainChildWindowResult: (result) =>
    ipcRenderer.send(IPC_CHANNELS.NOTIFY_MAIN_CHILD_WINDOW_RESULT, result),
  returnMainChildWindowValue: (requestId, value) =>
    ipcRenderer.invoke(IPC_CHANNELS.RETURN_MAIN_CHILD_WINDOW_VALUE, requestId, value),
  onMainChildWindowResult: (callback) =>
    createEventListener<MainChildWindowResult>(
      IPC_CHANNELS.EVENT_MAIN_CHILD_WINDOW_RESULT,
      callback
    ),
  // パフォーマンス計測API
  logPerformanceTiming: (label, duration) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOG_PERFORMANCE_TIMING, label, duration),
  // スプラッシュスクリーン関連API
  splashReady: () => ipcRenderer.invoke(IPC_CHANNELS.SPLASH_READY),
  onSplashInitComplete: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.SPLASH_INIT_COMPLETE, callback),
  notifyRendererReady: () => ipcRenderer.invoke(IPC_CHANNELS.RENDERER_READY),
  // カスタムアイコン関連API
  selectCustomIconFile: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_CUSTOM_ICON_FILE),
  saveCustomIcon: (sourceFilePath, itemIdentifier) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CUSTOM_ICON, sourceFilePath, itemIdentifier),
  deleteCustomIcon: (customIconFileName) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_CUSTOM_ICON, customIconFileName),
  getCustomIcon: (customIconFileName) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CUSTOM_ICON, customIconFileName),
  // 検索履歴関連API
  loadSearchHistory: () => ipcRenderer.invoke(IPC_CHANNELS.LOAD_SEARCH_HISTORY),
  addSearchHistoryEntry: (query) =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_SEARCH_HISTORY_ENTRY, query),
  clearSearchHistory: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_SEARCH_HISTORY),
  // アプリ情報関連API
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_INFO),
  openExternalUrl: (url) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL_URL, url),
  openFolder: (folderPath) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_FOLDER, folderPath),
  // ウィンドウ検索API
  activateWindowByHwnd: (hwnd) => ipcRenderer.invoke(IPC_CHANNELS.ACTIVATE_WINDOW, hwnd),
  moveWindowToDesktop: (hwnd, desktopNumber) =>
    ipcRenderer.invoke(IPC_CHANNELS.MOVE_WINDOW_TO_DESKTOP, hwnd, desktopNumber),
  pinWindow: (hwnd) => ipcRenderer.invoke(IPC_CHANNELS.PIN_WINDOW, hwnd),
  unPinWindow: (hwnd) => ipcRenderer.invoke(IPC_CHANNELS.UNPIN_WINDOW, hwnd),
  isWindowPinned: (hwnd) => ipcRenderer.invoke(IPC_CHANNELS.IS_WINDOW_PINNED, hwnd),
  closeWindow: (hwnd) => ipcRenderer.invoke(IPC_CHANNELS.CLOSE_WINDOW, hwnd),
  waitForWindowsClosed: (hwnds) => ipcRenderer.invoke(IPC_CHANNELS.WAIT_FOR_WINDOWS_CLOSED, hwnds),
  // システム通知API
  // トーストウィンドウAPI（メインウィンドウが閉じた後も表示可能）
  showToastWindow: (options) => ipcRenderer.invoke(IPC_CHANNELS.SHOW_TOAST_WINDOW, options),
  onShowToast: (callback) =>
    createEventListener<ToastEventData>(IPC_CHANNELS.EVENT_SHOW_TOAST, callback),
  // ワークスペースウィンドウ制御API
  toggleWorkspaceWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_TOGGLE_WINDOW),
  // ワークスペース関連API
  workspaceAPI: {
    // ワークスペース（タブ）管理
    loadWorkspaces: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LOAD_WORKSPACES),
    createWorkspace: (name) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_CREATE_WORKSPACE, name),
    renameWorkspace: (id, name) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_RENAME_WORKSPACE, id, name),
    deleteWorkspace: (id) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DELETE_WORKSPACE, id),
    reorderWorkspaces: (ids) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_REORDER_WORKSPACES, ids),
    // アイテム管理
    loadItems: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LOAD_ITEMS),
    addItem: (item, groupId, workspaceId) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ADD_ITEM, item, groupId, workspaceId),
    addItemsFromPaths: (filePaths, groupId, workspaceId) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.WORKSPACE_ADD_ITEMS_FROM_PATHS,
        filePaths,
        groupId,
        workspaceId
      ),
    removeItem: (id) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_REMOVE_ITEM, id),
    updateDisplayName: (id, displayName) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_UPDATE_DISPLAY_NAME, id, displayName),
    updateItem: (id, updates) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_UPDATE_ITEM, id, updates),
    launchItem: (item) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LAUNCH_ITEM, item),
    // グループ管理
    loadGroups: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LOAD_GROUPS),
    createGroup: (name, color, parentGroupId, workspaceId) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.WORKSPACE_CREATE_GROUP,
        name,
        color,
        parentGroupId,
        workspaceId
      ),
    updateGroup: (id, updates) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_UPDATE_GROUP, id, updates),
    deleteGroup: (id, deleteItems) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DELETE_GROUP, id, deleteItems),
    reorderMixed: (parentGroupId, entries) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_REORDER_MIXED, parentGroupId, entries),
    duplicateItem: (sourceItemId, targetGroupId, insertOrder) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.WORKSPACE_DUPLICATE_ITEM,
        sourceItemId,
        targetGroupId,
        insertOrder
      ),
    moveItemToGroup: (itemId, groupId) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_MOVE_ITEM_TO_GROUP, itemId, groupId),
    moveGroupToParent: (groupId, newParentGroupId) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_MOVE_GROUP_TO_PARENT, groupId, newParentGroupId),
    moveItemToWorkspace: (itemId, targetWorkspaceId) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_MOVE_ITEM_TO_WORKSPACE, itemId, targetWorkspaceId),
    moveGroupToWorkspace: (groupId, targetWorkspaceId) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.WORKSPACE_MOVE_GROUP_TO_WORKSPACE,
        groupId,
        targetWorkspaceId
      ),
    setGroupsCollapsed: (ids, collapsed) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET_GROUPS_COLLAPSED, ids, collapsed),
    // アーカイブ管理
    archiveGroup: (groupId) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_ARCHIVE_GROUP, groupId),
    loadArchivedGroups: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LOAD_ARCHIVED_GROUPS),
    loadArchivedItems: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LOAD_ARCHIVED_ITEMS),
    deleteArchivedGroup: (groupId) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DELETE_ARCHIVED_GROUP, groupId),
    // ピン留め関連
    getAlwaysOnTop: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_ALWAYS_ON_TOP),
    toggleAlwaysOnTop: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_TOGGLE_ALWAYS_ON_TOP),
    openItemEditor: (itemId) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_OPEN_ITEM_EDITOR, itemId),
    openConfirm: (request) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_OPEN_CONFIRM, request),
    getConfirmRequest: (requestId) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_CONFIRM_REQUEST, requestId),
    returnConfirmResult: (requestId, result) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_RETURN_CONFIRM_RESULT, requestId, result),
    // 透過度関連
    // サイズ変更関連
    setSize: (width, height) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET_SIZE, width, height),
    setPositionAndSize: (x, y, width, height) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET_POSITION_AND_SIZE, x, y, width, height),
    // 位置モード設定（displayLeft/displayRight/fixed等）
    setPositionMode: (mode) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET_POSITION_MODE, mode),
    // ウィンドウ制御
    hideWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_HIDE_WINDOW),
    // 切り離しウィンドウ
    detachGroup: (groupId, cursorX, cursorY) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_DETACH_GROUP, groupId, cursorX, cursorY),
    closeDetachedGroup: (groupId) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_CLOSE_DETACHED_GROUP, groupId),
    resizeCallerWindow: (width, height) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_RESIZE_CALLER_WINDOW, width, height),
    setCallerBounds: (x, y, width, height) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SET_CALLER_BOUNDS, x, y, width, height),
    // 切り離しウィンドウ状態永続化
    loadDetachedState: (rootGroupId) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_LOAD_DETACHED_STATE, rootGroupId),
    saveDetachedCollapsed: (rootGroupId, states) =>
      ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SAVE_DETACHED_COLLAPSED, rootGroupId, states),
  },
  // コンテキストメニュー表示API
  showAdminItemContextMenu: (selectedCount, isSingleLine) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_ADMIN_ITEM_CONTEXT_MENU, selectedCount, isSingleLine),
  // AdminItemManagerContextMenuイベントリスナー
  onAdminMenuDuplicateItems: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_ADMIN_MENU_DUPLICATE_ITEMS, callback),
  onAdminMenuEditItem: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_ADMIN_MENU_EDIT_ITEM, callback),
  onAdminMenuDeleteItems: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_ADMIN_MENU_DELETE_ITEMS, callback),
  // LauncherContextMenu
  showLauncherContextMenu: (item) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_LAUNCHER_CONTEXT_MENU, item),
  onLauncherMenuEditItem: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_EDIT_ITEM, callback),
  onLauncherMenuAddToWorkspace: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_ADD_TO_WORKSPACE, callback),
  onLauncherMenuCopyPath: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PATH, callback),
  onLauncherMenuCopyParentPath: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PARENT_PATH, callback),
  onLauncherMenuOpenParentFolder: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_PARENT_FOLDER, callback),
  onLauncherMenuCopyShortcutPath: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PATH, callback),
  onLauncherMenuCopyShortcutParentPath: (callback) =>
    createEventListener<AppItem>(
      IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PARENT_PATH,
      callback
    ),
  onLauncherMenuOpenShortcutParentFolder: (callback) =>
    createEventListener<AppItem>(
      IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
      callback
    ),
  onLauncherMenuShowMemo: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_SHOW_MEMO, callback),
  // WorkspaceTabContextMenu
  showWorkspaceTabContextMenu: (workspaceId, canDelete) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_WORKSPACE_TAB_CONTEXT_MENU, workspaceId, canDelete),
  onWorkspaceTabMenuRename: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_TAB_MENU_RENAME, callback),
  onWorkspaceTabMenuDelete: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_TAB_MENU_DELETE, callback),
  // FileTabContextMenu
  showFileTabContextMenu: (tabIndex) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_FILE_TAB_CONTEXT_MENU, tabIndex),
  onFileTabMenuRename: (callback) =>
    createEventListener<number>(IPC_CHANNELS.EVENT_FILE_TAB_MENU_RENAME, callback),
  // WindowContextMenu
  showWindowContextMenu: (windowInfo, desktopInfo, isPinned) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_WINDOW_CONTEXT_MENU, windowInfo, desktopInfo, isPinned),
  onWindowMenuActivate: (callback) =>
    createEventListener<WindowInfo>(IPC_CHANNELS.EVENT_WINDOW_MENU_ACTIVATE, callback),
  onWindowMenuAddToWorkspace: (callback) =>
    createEventListener<{ windowInfo: WindowInfo; includePosition: boolean }>(
      IPC_CHANNELS.EVENT_WINDOW_MENU_ADD_TO_WORKSPACE,
      callback
    ),
  showWindowsContextMenu: (count, desktopInfo) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_WINDOWS_CONTEXT_MENU, count, desktopInfo),
  onWindowsMenuClose: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_WINDOWS_MENU_CLOSE, callback),
  onWindowsMenuPin: (callback) =>
    createEventListener<boolean>(IPC_CHANNELS.EVENT_WINDOWS_MENU_PIN, callback),
  onWindowsMenuMoveToDesktop: (callback) =>
    createEventListener<number>(IPC_CHANNELS.EVENT_WINDOWS_MENU_MOVE_TO_DESKTOP, callback),
  onWindowMenuClose: (callback) =>
    createEventListener<WindowInfo>(IPC_CHANNELS.EVENT_WINDOW_MENU_CLOSE, callback),
  onMoveWindowToDesktop: (callback) =>
    createEventListener2<number | bigint, number>(
      IPC_CHANNELS.EVENT_WINDOW_MENU_MOVE_TO_DESKTOP,
      callback
    ),
  onPinWindow: (callback) =>
    createEventListener<number | bigint>(IPC_CHANNELS.EVENT_WINDOW_MENU_PIN, callback),
  onUnPinWindow: (callback) =>
    createEventListener<number | bigint>(IPC_CHANNELS.EVENT_WINDOW_MENU_UNPIN, callback),
  // WorkspaceContextMenu
  showWorkspaceContextMenu: (item, groups, workspaces) =>
    ipcRenderer.invoke(IPC_CHANNELS.SHOW_WORKSPACE_CONTEXT_MENU, item, groups, workspaces),
  onWorkspaceMenuRenameItem: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_RENAME_ITEM, callback),
  onWorkspaceMenuEditItem: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_EDIT_ITEM, callback),
  onRegisterWorkspaceItemToMain: (callback) =>
    createEventListener<WorkspaceItem>(
      IPC_CHANNELS.EVENT_WORKSPACE_MENU_REGISTER_TO_MAIN,
      callback
    ),
  onWorkspaceMenuShowMemo: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_SHOW_MEMO, callback),
  onWorkspaceMenuCopyPath: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_PATH, callback),
  onWorkspaceMenuCopyParentPath: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_PARENT_PATH, callback),
  onWorkspaceMenuOpenParentFolder: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_OPEN_PARENT_FOLDER, callback),
  onWorkspaceMenuCopyShortcutPath: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PATH, callback),
  onWorkspaceMenuCopyShortcutParentPath: (callback) =>
    createEventListener<string>(
      IPC_CHANNELS.EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PARENT_PATH,
      callback
    ),
  onWorkspaceMenuOpenShortcutParentFolder: (callback) =>
    createEventListener<string>(
      IPC_CHANNELS.EVENT_WORKSPACE_MENU_OPEN_SHORTCUT_PARENT_FOLDER,
      callback
    ),
  onWorkspaceMenuRemoveFromGroup: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_REMOVE_FROM_GROUP, callback),
  onWorkspaceMenuRemoveItem: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_REMOVE_ITEM, callback),
  onWorkspaceMenuMoveToWorkspace: (callback) =>
    createEventListener2<string, string>(
      IPC_CHANNELS.EVENT_WORKSPACE_MENU_MOVE_TO_WORKSPACE,
      callback
    ),
  // WorkspaceGroupContextMenu
  showWorkspaceGroupContextMenu: (group, canAddSubgroup, workspaces, isArchived) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.SHOW_WORKSPACE_GROUP_CONTEXT_MENU,
      group,
      canAddSubgroup,
      workspaces,
      isArchived
    ),
  onWorkspaceGroupMenuRename: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_RENAME, callback),
  onWorkspaceGroupMenuShowColorPicker: (callback) =>
    createEventListener<string>(
      IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_SHOW_COLOR_PICKER,
      callback
    ),
  onWorkspaceGroupMenuCopyAsText: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_COPY_AS_TEXT, callback),
  onWorkspaceGroupMenuArchive: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ARCHIVE, callback),
  onWorkspaceGroupMenuDelete: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_DELETE, callback),
  onWorkspaceGroupMenuAddSubgroup: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ADD_SUBGROUP, callback),
  onWorkspaceGroupMenuMoveToWorkspace: (callback) =>
    createEventListener2<string, string>(
      IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_MOVE_TO_WORKSPACE,
      callback
    ),
  // ブックマーク自動取込API
  bookmarkAutoImportAPI: {
    getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_GET_SETTINGS),
    saveSettings: (settings) =>
      ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_SAVE_SETTINGS, settings),
    executeRule: (rule) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_EXECUTE_RULE, rule),
    executeAll: () => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_EXECUTE_ALL),
    getBookmarksWithFolders: (bookmarkPath) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_GET_BOOKMARKS_WITH_FOLDERS,
        bookmarkPath
      ),
    deleteRuleItems: (ruleId, targetFile) =>
      ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_DELETE_RULE_ITEMS, ruleId, targetFile),
  },
  // クリップボード関連API
  clipboardAPI: {
    checkCurrent: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_CHECK_CURRENT),
    capture: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_CAPTURE),
    restore: (dataFileRef) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_RESTORE, dataFileRef),
    // セッション管理（登録確定前の一時保存）
    captureToSession: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_CAPTURE_TO_SESSION),
    commitSession: (sessionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_COMMIT_SESSION, sessionId),
    discardSession: (sessionId) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_DISCARD_SESSION, sessionId),
    duplicateData: (dataFileRef) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_DUPLICATE_DATA, dataFileRef),
    saveText: (text) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_SAVE_TEXT, text),
    readContent: (source) => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_READ_CONTENT, source),
  },
  // バックアップAPI
  backupAPI: {
    listSnapshots: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_LIST_SNAPSHOTS),
    restoreSnapshot: (timestamp) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RESTORE_SNAPSHOT, timestamp),
    deleteSnapshot: (timestamp) =>
      ipcRenderer.invoke(IPC_CHANNELS.BACKUP_DELETE_SNAPSHOT, timestamp),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_GET_STATUS),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
