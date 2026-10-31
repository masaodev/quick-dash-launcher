import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  PinLevel,
  IconProgress,
  LayoutExecutionProgress,
  AppItem,
  WindowInfo,
  MainChildWindowResult,
  ToastEventData,
  AdminTab,
  WorkspaceTarget,
} from '@common/types';
import type { ElectronAPI } from '@common/types/electronApi';
import type { IpcInvokeArgs, IpcInvokeChannel, IpcInvokeResult } from '@common/types/ipcInvokeMap';
import {
  IPC_CHANNELS,
  ICON_PROGRESS_CHANNELS,
  LAYOUT_PROGRESS_CHANNELS,
} from '@common/ipcChannels';

/** invoke を対応表（IpcInvokeMap）で型付けして呼ぶ。メインプロセスの handleIpc と同じ表を見る */
function ipcInvoke<C extends IpcInvokeChannel>(
  channel: C,
  ...args: IpcInvokeArgs<C>
): Promise<IpcInvokeResult<C>> {
  return ipcRenderer.invoke(channel, ...args);
}

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
  getConfigFolder: () => ipcInvoke(IPC_CHANNELS.GET_CONFIG_FOLDER),
  getDataFiles: () => ipcInvoke(IPC_CHANNELS.GET_DATA_FILES),
  createDataFile: (fileName) => ipcInvoke(IPC_CHANNELS.CREATE_DATA_FILE, fileName),
  deleteDataFile: (fileName) => ipcInvoke(IPC_CHANNELS.DELETE_DATA_FILE, fileName),
  // trigger: 'full' は「アイコンをすべて取り直す」、'internal' は変更通知・画面内の一覧取得（レポートは報告事項があるときだけ更新）
  loadDataFiles: (trigger) => ipcInvoke(IPC_CHANNELS.LOAD_DATA_FILES, trigger),
  getCorruptedDataFiles: () => ipcInvoke(IPC_CHANNELS.GET_CORRUPTED_DATA_FILES),
  openItem: (item, options) => ipcInvoke(IPC_CHANNELS.OPEN_ITEM, item, options),
  openParentFolder: (item) => ipcInvoke(IPC_CHANNELS.OPEN_PARENT_FOLDER, item),
  runItemAsAdmin: (item) => ipcInvoke(IPC_CHANNELS.RUN_ITEM_AS_ADMIN, item),
  executeSet: (item, allItems) => ipcInvoke(IPC_CHANNELS.EXECUTE_SET, item, allItems),
  openWsGroup: (groupId) => ipcInvoke(IPC_CHANNELS.OPEN_WS_GROUP, groupId),
  openConfigFolder: () => ipcInvoke(IPC_CHANNELS.OPEN_CONFIG_FOLDER),
  fetchFavicon: (url) => ipcInvoke(IPC_CHANNELS.FETCH_FAVICON, url),
  extractIcon: (filePath) => ipcInvoke(IPC_CHANNELS.EXTRACT_ICON, filePath),
  getIconForItem: (filePath, itemType) =>
    ipcInvoke(IPC_CHANNELS.GET_ICON_FOR_ITEM, filePath, itemType),
  loadCachedIcons: (items) => ipcInvoke(IPC_CHANNELS.LOAD_CACHED_ICONS, items),
  // 統合進捗付きアイコン取得API
  fetchIconsCombined: (urlItems, items, forceRefresh = false, silent = false) =>
    ipcInvoke(IPC_CHANNELS.FETCH_ICONS_COMBINED, urlItems, items, forceRefresh, silent),
  // キャッシュ欠損の補完API（進捗通知なし）
  ensureIcons: (items) => ipcInvoke(IPC_CHANNELS.ENSURE_ICONS, items),
  requestFetchMissingIcons: () => ipcInvoke(IPC_CHANNELS.REQUEST_FETCH_MISSING_ICONS),
  onFetchMissingIconsRequested: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_FETCH_MISSING_ICONS_REQUESTED, callback),
  // アイコン取得エラー記録をクリア
  // アイコン取得エラー記録を取得
  getIconFetchErrors: () => ipcInvoke(IPC_CHANNELS.GET_ICON_FETCH_ERRORS),
  onIconProgress: (eventType, callback) =>
    createEventListener<IconProgress>(ICON_PROGRESS_CHANNELS[eventType], callback),
  onLayoutProgress: (eventType, callback) =>
    createEventListener<LayoutExecutionProgress>(LAYOUT_PROGRESS_CHANNELS[eventType], callback),
  cancelLayout: () => ipcRenderer.send(IPC_CHANNELS.LAYOUT_CANCEL),
  closeLayoutProgressWindow: () => ipcRenderer.send(IPC_CHANNELS.CLOSE_LAYOUT_PROGRESS_WINDOW),
  resizeLayoutProgressWindow: (contentHeight) =>
    ipcRenderer.send(IPC_CHANNELS.RESIZE_LAYOUT_PROGRESS_WINDOW, contentHeight),
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
  onAdminHidden: (callback) => createEventListenerNoArg(IPC_CHANNELS.EVENT_ADMIN_HIDDEN, callback),
  onOpenImportModal: (callback) =>
    createEventListener<'bookmark' | 'app'>(IPC_CHANNELS.EVENT_OPEN_IMPORT_MODAL, callback),
  onDataChanged: (callback) => createEventListenerNoArg(IPC_CHANNELS.EVENT_DATA_CHANGED, callback),
  onSettingsChanged: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, callback),
  isWorkspaceOpen: () => ipcInvoke(IPC_CHANNELS.WORKSPACE_IS_OPEN),
  onWorkspaceOpenChanged: (callback) =>
    createEventListener<boolean>(IPC_CHANNELS.EVENT_WORKSPACE_OPEN_CHANGED, callback),
  onWorkspaceRefitHeight: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_WORKSPACE_REFIT_HEIGHT, callback),
  onWorkspaceChanged: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.WORKSPACE_CHANGED, callback),
  pin: {
    get: () => ipcInvoke(IPC_CHANNELS.PIN_GET),
    set: (level) => ipcInvoke(IPC_CHANNELS.PIN_SET, level),
    showMenu: () => ipcInvoke(IPC_CHANNELS.PIN_SHOW_MENU),
    onChanged: (callback) =>
      createEventListener<PinLevel>(IPC_CHANNELS.EVENT_PIN_CHANGED, callback),
  },
  setEscapeHandledByPage: (handled) =>
    ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_ESCAPE_HANDLED_BY_PAGE, handled),
  startWindowMove: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_START_MOVE),
  registerItems: (items) => ipcInvoke(IPC_CHANNELS.REGISTER_ITEMS, items),
  getPathKind: (filePath) => ipcInvoke(IPC_CHANNELS.PATH_GET_KIND, filePath),
  selectItemPath: (kind, currentPath) => ipcInvoke(IPC_CHANNELS.PATH_SELECT, kind, currentPath),
  previewDirItems: (dirPath, options) => ipcInvoke(IPC_CHANNELS.DIR_PREVIEW_RUN, dirPath, options),
  cancelDirPreview: () => ipcInvoke(IPC_CHANNELS.DIR_PREVIEW_CANCEL),
  getDefaultBrowser: () => ipcInvoke(IPC_CHANNELS.BROWSER_GET_DEFAULT),
  getFileHandler: (extension) => ipcInvoke(IPC_CHANNELS.FILE_GET_HANDLER, extension),
  checkPathsExist: (paths) => ipcInvoke(IPC_CHANNELS.CHECK_PATHS_EXIST, paths),
  exportItemsCsv: (text, defaultName) =>
    ipcInvoke(IPC_CHANNELS.ITEMS_CSV_EXPORT, text, defaultName),
  readItemsCsv: () => ipcInvoke(IPC_CHANNELS.ITEMS_CSV_READ),
  getLaunchUsage: () => ipcInvoke(IPC_CHANNELS.GET_LAUNCH_USAGE),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  quitApp: () => ipcInvoke(IPC_CHANNELS.QUIT_APP),
  getAllWindows: () => ipcInvoke(IPC_CHANNELS.GET_ALL_WINDOWS),
  getAllWindowsAllDesktops: () => ipcInvoke(IPC_CHANNELS.GET_ALL_WINDOWS_ALL_DESKTOPS),
  getVirtualDesktopInfo: () => ipcInvoke(IPC_CHANNELS.GET_VIRTUAL_DESKTOP_INFO),
  updateItemById: (request) => ipcInvoke(IPC_CHANNELS.UPDATE_ITEM_BY_ID, request),
  deleteItemsById: (requests, options) =>
    ipcInvoke(IPC_CHANNELS.DELETE_ITEMS_BY_ID, requests, options),
  findSetsUsingItems: (ids) => ipcInvoke(IPC_CHANNELS.FIND_SETS_USING_ITEMS, ids),
  // EditableJsonItem API
  loadEditableItems: () => ipcInvoke(IPC_CHANNELS.LOAD_EDITABLE_ITEMS),
  saveEditableItems: (editableItems, expectedHashes) =>
    ipcInvoke(IPC_CHANNELS.SAVE_EDITABLE_ITEMS, editableItems, expectedHashes),
  // IDベースのアイテム更新
  updateDirItemById: (id, dirPath, options, memo) =>
    ipcInvoke(IPC_CHANNELS.UPDATE_DIR_ITEM_BY_ID, id, dirPath, options, memo),
  updateSetItemById: (id, set, memo) =>
    ipcInvoke(IPC_CHANNELS.UPDATE_SET_ITEM_BY_ID, id, set, memo),
  selectBookmarkFile: () => ipcInvoke(IPC_CHANNELS.SELECT_BOOKMARK_FILE),
  parseBookmarkFileWithFolders: (filePath) =>
    ipcInvoke(IPC_CHANNELS.PARSE_BOOKMARK_FILE_WITH_FOLDERS, filePath),
  // ブラウザブックマーク直接インポートAPI
  detectInstalledBrowsers: () => ipcInvoke(IPC_CHANNELS.DETECT_INSTALLED_BROWSERS),
  // アプリインポートAPI
  scanInstalledApps: (scanId) => ipcInvoke(IPC_CHANNELS.SCAN_INSTALLED_APPS, scanId),
  onAppScanProgress: (callback) =>
    createEventListener<{ scanId: number; found: number }>(
      IPC_CHANNELS.EVENT_APP_SCAN_PROGRESS,
      callback
    ),
  // Settings API
  getSettings: () => ipcInvoke(IPC_CHANNELS.SETTINGS_GET),
  getDefaultSettings: () => ipcInvoke(IPC_CHANNELS.SETTINGS_GET_DEFAULTS),
  setMultipleSettings: (settings) => ipcInvoke(IPC_CHANNELS.SETTINGS_SET_MULTIPLE, settings),
  resetSettings: (keys) => ipcInvoke(IPC_CHANNELS.SETTINGS_RESET, keys),
  reapplySettings: () => ipcInvoke(IPC_CHANNELS.SETTINGS_REAPPLY),
  validateHotkey: (hotkey) => ipcInvoke(IPC_CHANNELS.SETTINGS_VALIDATE_HOTKEY, hotkey),
  changeHotkey: (newHotkey) => ipcInvoke(IPC_CHANNELS.SETTINGS_CHANGE_HOTKEY, newHotkey),
  changeItemSearchHotkey: (newHotkey) =>
    ipcInvoke(IPC_CHANNELS.SETTINGS_CHANGE_ITEM_SEARCH_HOTKEY, newHotkey),
  isItemSearchHotkeyAvailable: (hotkey) =>
    ipcInvoke(IPC_CHANNELS.SETTINGS_IS_ITEM_SEARCH_HOTKEY_AVAILABLE, hotkey),
  setHotkeyRecording: (recording) =>
    ipcInvoke(IPC_CHANNELS.SETTINGS_SET_HOTKEY_RECORDING, recording),
  getDisplays: () => ipcInvoke(IPC_CHANNELS.SETTINGS_GET_DISPLAYS),
  getScreenAreas: () => ipcInvoke(IPC_CHANNELS.GET_SCREEN_AREAS),
  getAutoLaunchStatus: () => ipcInvoke(IPC_CHANNELS.SETTINGS_GET_AUTO_LAUNCH_STATUS),
  getLanguage: () => ipcInvoke(IPC_CHANNELS.SETTINGS_GET_LANGUAGE),
  isFirstLaunch: () => ipcInvoke(IPC_CHANNELS.SETTINGS_IS_FIRST_LAUNCH),
  // 編集ウィンドウ関連API
  hideEditWindow: () => ipcInvoke(IPC_CHANNELS.HIDE_EDIT_WINDOW),
  toggleEditWindow: () => ipcInvoke(IPC_CHANNELS.TOGGLE_EDIT_WINDOW),
  openEditWindowWithTab: (tab) => ipcInvoke(IPC_CHANNELS.OPEN_EDIT_WINDOW_WITH_TAB, tab),
  openEditWindowWithImportModal: (modal) =>
    ipcInvoke(IPC_CHANNELS.OPEN_EDIT_WINDOW_WITH_IMPORT_MODAL, modal),
  getInitialTab: () => ipcInvoke(IPC_CHANNELS.GET_INITIAL_TAB),
  getPendingImportModal: () => ipcInvoke(IPC_CHANNELS.GET_PENDING_IMPORT_MODAL),
  copyToClipboard: (text) => ipcInvoke(IPC_CHANNELS.COPY_TO_CLIPBOARD, text),
  readClipboardForRegister: () => ipcInvoke(IPC_CHANNELS.CLIPBOARD_READ_FOR_REGISTER),
  // メイン画面の子ウィンドウ（アイテムの登録・編集、アイコン取得結果）
  openMainChildWindow: (request) => ipcInvoke(IPC_CHANNELS.OPEN_MAIN_CHILD_WINDOW, request),
  getMainChildWindowRequest: (requestId) =>
    ipcInvoke(IPC_CHANNELS.GET_MAIN_CHILD_WINDOW_REQUEST, requestId),
  notifyMainChildWindowResult: (result) =>
    ipcRenderer.send(IPC_CHANNELS.NOTIFY_MAIN_CHILD_WINDOW_RESULT, result),
  returnMainChildWindowValue: (requestId, value) =>
    ipcInvoke(IPC_CHANNELS.RETURN_MAIN_CHILD_WINDOW_VALUE, requestId, value),
  onMainChildWindowResult: (callback) =>
    createEventListener<MainChildWindowResult>(
      IPC_CHANNELS.EVENT_MAIN_CHILD_WINDOW_RESULT,
      callback
    ),
  // パフォーマンス計測API
  logPerformanceTiming: (label, duration) =>
    ipcInvoke(IPC_CHANNELS.LOG_PERFORMANCE_TIMING, label, duration),
  // スプラッシュスクリーン関連API
  splashReady: () => ipcInvoke(IPC_CHANNELS.SPLASH_READY),
  onSplashInitComplete: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.SPLASH_INIT_COMPLETE, callback),
  notifyRendererReady: () => ipcInvoke(IPC_CHANNELS.RENDERER_READY),
  // カスタムアイコン関連API
  selectCustomIconFile: () => ipcInvoke(IPC_CHANNELS.SELECT_CUSTOM_ICON_FILE),
  saveCustomIcon: (sourceFilePath, itemIdentifier) =>
    ipcInvoke(IPC_CHANNELS.SAVE_CUSTOM_ICON, sourceFilePath, itemIdentifier),
  deleteCustomIcon: (customIconFileName) =>
    ipcInvoke(IPC_CHANNELS.DELETE_CUSTOM_ICON, customIconFileName),
  getCustomIcon: (customIconFileName) =>
    ipcInvoke(IPC_CHANNELS.GET_CUSTOM_ICON, customIconFileName),
  // 検索履歴関連API
  loadSearchHistory: () => ipcInvoke(IPC_CHANNELS.LOAD_SEARCH_HISTORY),
  addSearchHistoryEntry: (query) => ipcInvoke(IPC_CHANNELS.ADD_SEARCH_HISTORY_ENTRY, query),
  clearSearchHistory: () => ipcInvoke(IPC_CHANNELS.CLEAR_SEARCH_HISTORY),
  // アプリ情報関連API
  getAppInfo: () => ipcInvoke(IPC_CHANNELS.GET_APP_INFO),
  getUpdateStatus: () => ipcInvoke(IPC_CHANNELS.GET_UPDATE_STATUS),
  checkForUpdates: () => ipcInvoke(IPC_CHANNELS.CHECK_FOR_UPDATES),
  openExternalUrl: (url) => ipcInvoke(IPC_CHANNELS.OPEN_EXTERNAL_URL, url),
  openFolder: (folderPath) => ipcInvoke(IPC_CHANNELS.SHELL_OPEN_FOLDER, folderPath),
  // ウィンドウ検索API
  activateWindowByHwnd: (hwnd) => ipcInvoke(IPC_CHANNELS.ACTIVATE_WINDOW, hwnd),
  moveWindowToDesktop: (hwnd, desktopNumber) =>
    ipcInvoke(IPC_CHANNELS.MOVE_WINDOW_TO_DESKTOP, hwnd, desktopNumber),
  pinWindow: (hwnd) => ipcInvoke(IPC_CHANNELS.PIN_WINDOW, hwnd),
  unPinWindow: (hwnd) => ipcInvoke(IPC_CHANNELS.UNPIN_WINDOW, hwnd),
  isWindowPinned: (hwnd) => ipcInvoke(IPC_CHANNELS.IS_WINDOW_PINNED, hwnd),
  closeWindow: (hwnd) => ipcInvoke(IPC_CHANNELS.CLOSE_WINDOW, hwnd),
  waitForWindowsClosed: (hwnds) => ipcInvoke(IPC_CHANNELS.WAIT_FOR_WINDOWS_CLOSED, hwnds),
  // システム通知API
  // トーストウィンドウAPI（メインウィンドウが閉じた後も表示可能）
  showToastWindow: (options) => ipcInvoke(IPC_CHANNELS.SHOW_TOAST_WINDOW, options),
  onShowToast: (callback) =>
    createEventListener<ToastEventData>(IPC_CHANNELS.EVENT_SHOW_TOAST, callback),
  // ワークスペースウィンドウ制御API
  toggleWorkspaceWindow: () => ipcInvoke(IPC_CHANNELS.WORKSPACE_TOGGLE_WINDOW),
  // ワークスペース関連API
  workspaceAPI: {
    // ワークスペース（タブ）管理
    loadWorkspaces: () => ipcInvoke(IPC_CHANNELS.WORKSPACE_LOAD_WORKSPACES),
    createWorkspace: (name) => ipcInvoke(IPC_CHANNELS.WORKSPACE_CREATE_WORKSPACE, name),
    renameWorkspace: (id, name) => ipcInvoke(IPC_CHANNELS.WORKSPACE_RENAME_WORKSPACE, id, name),
    deleteWorkspace: (id) => ipcInvoke(IPC_CHANNELS.WORKSPACE_DELETE_WORKSPACE, id),
    reorderWorkspaces: (ids) => ipcInvoke(IPC_CHANNELS.WORKSPACE_REORDER_WORKSPACES, ids),
    // アイテム管理
    loadItems: () => ipcInvoke(IPC_CHANNELS.WORKSPACE_LOAD_ITEMS),
    addItem: (item, groupId, workspaceId, options) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_ADD_ITEM, item, groupId, workspaceId, options),
    createItem: (body, groupId, workspaceId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_CREATE_ITEM, body, groupId, workspaceId),
    addItemsFromPaths: (filePaths, groupId, workspaceId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_ADD_ITEMS_FROM_PATHS, filePaths, groupId, workspaceId),
    removeItem: (id) => ipcInvoke(IPC_CHANNELS.WORKSPACE_REMOVE_ITEM, id),
    updateDisplayName: (id, displayName) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_UPDATE_DISPLAY_NAME, id, displayName),
    updateItem: (id, updates) => ipcInvoke(IPC_CHANNELS.WORKSPACE_UPDATE_ITEM, id, updates),
    launchItem: (item, options) => ipcInvoke(IPC_CHANNELS.WORKSPACE_LAUNCH_ITEM, item, options),
    // 参照アイテム
    convertToCopy: (id) => ipcInvoke(IPC_CHANNELS.WORKSPACE_CONVERT_TO_COPY, id),
    linkToMain: (id, mainItemId) => ipcInvoke(IPC_CHANNELS.WORKSPACE_LINK_TO_MAIN, id, mainItemId),
    moveToMain: (id, file) => ipcInvoke(IPC_CHANNELS.WORKSPACE_MOVE_TO_MAIN, id, file),
    findLinkCandidates: (id) => ipcInvoke(IPC_CHANNELS.WORKSPACE_FIND_LINK_CANDIDATES, id),
    previewLinkCopies: (workspaceId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_PREVIEW_LINK_COPIES, workspaceId),
    applyLinkCopies: (ids, choices) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_APPLY_LINK_COPIES, ids, choices),
    countRefs: (itemIds) => ipcInvoke(IPC_CHANNELS.WORKSPACE_COUNT_REFS, itemIds),
    remapRefs: (idMap) => ipcInvoke(IPC_CHANNELS.WORKSPACE_REMAP_REFS, idMap),
    // グループ管理
    loadGroups: () => ipcInvoke(IPC_CHANNELS.WORKSPACE_LOAD_GROUPS),
    duplicateGroup: (groupId, name) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_DUPLICATE_GROUP, groupId, name),
    createGroup: (name, color, parentGroupId, workspaceId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_CREATE_GROUP, name, color, parentGroupId, workspaceId),
    updateGroup: (id, updates) => ipcInvoke(IPC_CHANNELS.WORKSPACE_UPDATE_GROUP, id, updates),
    deleteGroup: (id) => ipcInvoke(IPC_CHANNELS.WORKSPACE_DELETE_GROUP, id),
    reorderMixed: (parentGroupId, entries) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_REORDER_MIXED, parentGroupId, entries),
    duplicateItem: (sourceItemId, targetGroupId, insertOrder) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_DUPLICATE_ITEM, sourceItemId, targetGroupId, insertOrder),
    moveItemToGroup: (itemId, groupId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_MOVE_ITEM_TO_GROUP, itemId, groupId),
    moveGroupToParent: (groupId, newParentGroupId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_MOVE_GROUP_TO_PARENT, groupId, newParentGroupId),
    moveItemToWorkspace: (itemId, targetWorkspaceId, groupId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_MOVE_ITEM_TO_WORKSPACE, itemId, targetWorkspaceId, groupId),
    moveGroupToWorkspace: (groupId, targetWorkspaceId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_MOVE_GROUP_TO_WORKSPACE, groupId, targetWorkspaceId),
    setGroupsCollapsed: (ids, collapsed) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_SET_GROUPS_COLLAPSED, ids, collapsed),
    // アーカイブ管理
    archiveGroup: (groupId) => ipcInvoke(IPC_CHANNELS.WORKSPACE_ARCHIVE_GROUP, groupId),
    loadArchivedGroups: () => ipcInvoke(IPC_CHANNELS.WORKSPACE_LOAD_ARCHIVED_GROUPS),
    loadArchivedItems: () => ipcInvoke(IPC_CHANNELS.WORKSPACE_LOAD_ARCHIVED_ITEMS),
    deleteArchivedGroup: (groupId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_DELETE_ARCHIVED_GROUP, groupId),
    // ピン留め関連
    getAlwaysOnTop: () => ipcInvoke(IPC_CHANNELS.WORKSPACE_GET_ALWAYS_ON_TOP),
    toggleAlwaysOnTop: () => ipcInvoke(IPC_CHANNELS.WORKSPACE_TOGGLE_ALWAYS_ON_TOP),
    openItemEditor: (itemId) => ipcInvoke(IPC_CHANNELS.WORKSPACE_OPEN_ITEM_EDITOR, itemId),
    openItemPicker: (groupId) => ipcInvoke(IPC_CHANNELS.WORKSPACE_OPEN_ITEM_PICKER, groupId),
    openLinkPicker: (itemId) => ipcInvoke(IPC_CHANNELS.WORKSPACE_OPEN_LINK_PICKER, itemId),
    openLinkCopies: (workspaceId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_OPEN_LINK_COPIES, workspaceId),
    openNewItemEditor: (groupId) => ipcInvoke(IPC_CHANNELS.WORKSPACE_OPEN_NEW_ITEM_EDITOR, groupId),
    openConfirm: (request) => ipcInvoke(IPC_CHANNELS.WORKSPACE_OPEN_CONFIRM, request),
    getConfirmRequest: (requestId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_GET_CONFIRM_REQUEST, requestId),
    returnConfirmResult: (requestId, result) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_RETURN_CONFIRM_RESULT, requestId, result),
    // 透過度関連
    // サイズ変更関連
    setHeight: (height) => ipcInvoke(IPC_CHANNELS.WORKSPACE_SET_HEIGHT, height),
    setPositionAndSize: (x, y, width, height) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_SET_POSITION_AND_SIZE, x, y, width, height),
    // 位置モード設定（displayLeft/displayRight/fixed等）
    setPositionMode: (mode) => ipcInvoke(IPC_CHANNELS.WORKSPACE_SET_POSITION_MODE, mode),
    // ウィンドウ制御
    hideWindow: () => ipcInvoke(IPC_CHANNELS.WORKSPACE_HIDE_WINDOW),
    // 切り離しウィンドウ
    detachGroup: (groupId, cursorX, cursorY) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_DETACH_GROUP, groupId, cursorX, cursorY),
    closeDetachedGroup: (groupId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_CLOSE_DETACHED_GROUP, groupId),
    resizeCallerWindow: (width, height) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_RESIZE_CALLER_WINDOW, width, height),
    setCallerBounds: (x, y, width, height) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_SET_CALLER_BOUNDS, x, y, width, height),
    // 切り離しウィンドウ状態永続化
    loadDetachedState: (rootGroupId) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_LOAD_DETACHED_STATE, rootGroupId),
    saveDetachedCollapsed: (rootGroupId, states) =>
      ipcInvoke(IPC_CHANNELS.WORKSPACE_SAVE_DETACHED_COLLAPSED, rootGroupId, states),
  },
  // コンテキストメニュー表示API
  showAdminItemContextMenu: (selectedCount, isSingleLine) =>
    ipcInvoke(IPC_CHANNELS.SHOW_ADMIN_ITEM_CONTEXT_MENU, selectedCount, isSingleLine),
  // AdminItemManagerContextMenuイベントリスナー
  onAdminMenuDuplicateItems: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_ADMIN_MENU_DUPLICATE_ITEMS, callback),
  onAdminMenuEditItem: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_ADMIN_MENU_EDIT_ITEM, callback),
  onAdminMenuDeleteItems: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_ADMIN_MENU_DELETE_ITEMS, callback),
  // LauncherContextMenu
  showLauncherContextMenu: (item, anchor) =>
    ipcInvoke(IPC_CHANNELS.SHOW_LAUNCHER_CONTEXT_MENU, item, anchor),
  onLauncherMenuEditItem: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_EDIT_ITEM, callback),
  onLauncherMenuAddToWorkspace: (callback) =>
    createEventListener<{ item: AppItem; target: WorkspaceTarget }>(
      IPC_CHANNELS.EVENT_LAUNCHER_MENU_ADD_TO_WORKSPACE,
      callback
    ),
  onLauncherMenuAddCopyToWorkspace: (callback) =>
    createEventListener<{ item: AppItem; target: WorkspaceTarget }>(
      IPC_CHANNELS.EVENT_LAUNCHER_MENU_ADD_COPY_TO_WORKSPACE,
      callback
    ),
  onLauncherMenuCopyPath: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PATH, callback),
  onLauncherMenuCopyParentPath: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_COPY_PARENT_PATH, callback),
  onLauncherMenuOpenParentFolder: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_OPEN_PARENT_FOLDER, callback),
  onLauncherMenuRunAsAdmin: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_RUN_AS_ADMIN, callback),
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
  onLauncherMenuDeleteItem: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_DELETE_ITEM, callback),
  onLauncherMenuExcludeFromDir: (callback) =>
    createEventListener<AppItem>(IPC_CHANNELS.EVENT_LAUNCHER_MENU_EXCLUDE_FROM_DIR, callback),
  showLauncherBlankContextMenu: () => ipcInvoke(IPC_CHANNELS.SHOW_LAUNCHER_BLANK_CONTEXT_MENU),
  onLauncherBlankMenuAddItem: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_LAUNCHER_BLANK_MENU_ADD_ITEM, callback),
  onLauncherBlankMenuRegisterFromClipboard: (callback) =>
    createEventListenerNoArg(
      IPC_CHANNELS.EVENT_LAUNCHER_BLANK_MENU_REGISTER_FROM_CLIPBOARD,
      callback
    ),
  onLauncherBlankMenuAddFolderImport: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_LAUNCHER_BLANK_MENU_ADD_FOLDER_IMPORT, callback),
  showSearchBoxContextMenu: (flags, history) =>
    ipcInvoke(IPC_CHANNELS.SHOW_SEARCH_BOX_CONTEXT_MENU, flags, history),
  onSearchBoxMenuPickHistory: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_SEARCH_BOX_MENU_PICK_HISTORY, callback),
  onSearchBoxMenuClearHistory: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_SEARCH_BOX_MENU_CLEAR_HISTORY, callback),
  // WorkspaceTabContextMenu
  showWorkspaceTabContextMenu: (workspaceId, canDelete) =>
    ipcInvoke(IPC_CHANNELS.SHOW_WORKSPACE_TAB_CONTEXT_MENU, workspaceId, canDelete),
  onWorkspaceTabMenuRename: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_TAB_MENU_RENAME, callback),
  onWorkspaceTabMenuDelete: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_TAB_MENU_DELETE, callback),
  // ワークスペースの余白・「未分類」の見出し・ヘッダーの ＋
  showWorkspaceBlankContextMenu: (workspaceId, kind, anchor) =>
    ipcInvoke(IPC_CHANNELS.SHOW_WORKSPACE_BLANK_CONTEXT_MENU, workspaceId, kind, anchor),
  onWorkspaceMenuAddGroup: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_ADD_GROUP, callback),
  onWorkspaceMenuAddWorkspace: (callback) =>
    createEventListenerNoArg(IPC_CHANNELS.EVENT_WORKSPACE_MENU_ADD_WORKSPACE, callback),
  onWorkspaceMenuSetAllCollapsed: (callback) =>
    createEventListener2<string, boolean>(
      IPC_CHANNELS.EVENT_WORKSPACE_MENU_SET_ALL_COLLAPSED,
      callback
    ),
  // FileTabContextMenu
  showFileTabContextMenu: (tabIndex) =>
    ipcInvoke(IPC_CHANNELS.SHOW_FILE_TAB_CONTEXT_MENU, tabIndex),
  onFileTabMenuRename: (callback) =>
    createEventListener<number>(IPC_CHANNELS.EVENT_FILE_TAB_MENU_RENAME, callback),
  // WindowContextMenu
  showWindowContextMenu: (windowInfo, desktopInfo, isPinned, anchor) =>
    ipcInvoke(IPC_CHANNELS.SHOW_WINDOW_CONTEXT_MENU, windowInfo, desktopInfo, isPinned, anchor),
  onWindowMenuActivate: (callback) =>
    createEventListener<WindowInfo>(IPC_CHANNELS.EVENT_WINDOW_MENU_ACTIVATE, callback),
  onWindowMenuAddToWorkspace: (callback) =>
    createEventListener<{
      windowInfo: WindowInfo;
      includePosition: boolean;
      target: WorkspaceTarget;
    }>(IPC_CHANNELS.EVENT_WINDOW_MENU_ADD_TO_WORKSPACE, callback),
  showWindowsContextMenu: (count, desktopInfo, anchor) =>
    ipcInvoke(IPC_CHANNELS.SHOW_WINDOWS_CONTEXT_MENU, count, desktopInfo, anchor),
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
    ipcInvoke(IPC_CHANNELS.SHOW_WORKSPACE_CONTEXT_MENU, item, groups, workspaces),
  onWorkspaceMenuRenameItem: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_RENAME_ITEM, callback),
  onWorkspaceMenuEditItem: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_EDIT_ITEM, callback),
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
  onWorkspaceMenuRemoveItem: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_REMOVE_ITEM, callback),
  onWorkspaceMenuMoveToGroup: (callback) =>
    createEventListener2<string, string>(IPC_CHANNELS.EVENT_WORKSPACE_MENU_MOVE_TO_GROUP, callback),
  onWorkspaceMenuMoveToWorkspace: (callback) => {
    const listener = (_event: unknown, itemId: string, workspaceId: string, groupId?: string) =>
      callback(itemId, workspaceId, groupId);
    ipcRenderer.on(IPC_CHANNELS.EVENT_WORKSPACE_MENU_MOVE_TO_WORKSPACE, listener);
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT_WORKSPACE_MENU_MOVE_TO_WORKSPACE, listener);
  },
  // WorkspaceGroupContextMenu
  showWorkspaceGroupContextMenu: (group, canAddSubgroup, workspaces, isArchived) =>
    ipcInvoke(
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
  onWorkspaceGroupMenuAddFromMain: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ADD_FROM_MAIN, callback),
  onWorkspaceGroupMenuAddNew: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_ADD_NEW, callback),
  onWorkspaceGroupMenuOpenAll: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_OPEN_ALL, callback),
  onWorkspaceGroupMenuDuplicate: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_DUPLICATE, callback),
  onWorkspaceGroupMenuCollapseOthers: (callback) =>
    createEventListener<string>(IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_COLLAPSE_OTHERS, callback),
  onWorkspaceGroupMenuMoveToWorkspace: (callback) =>
    createEventListener2<string, string>(
      IPC_CHANNELS.EVENT_WORKSPACE_GROUP_MENU_MOVE_TO_WORKSPACE,
      callback
    ),
  // ブックマーク自動取込API
  bookmarkAutoImportAPI: {
    getSettings: () => ipcInvoke(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_GET_SETTINGS),
    saveSettings: (settings) =>
      ipcInvoke(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_SAVE_SETTINGS, settings),
    executeRule: (rule) => ipcInvoke(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_EXECUTE_RULE, rule),
    executeAll: () => ipcInvoke(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_EXECUTE_ALL),
    getBookmarksWithFolders: (bookmarkPath) =>
      ipcInvoke(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_GET_BOOKMARKS_WITH_FOLDERS, bookmarkPath),
    deleteRuleItems: (ruleId, targetFile) =>
      ipcInvoke(IPC_CHANNELS.BOOKMARK_AUTO_IMPORT_DELETE_RULE_ITEMS, ruleId, targetFile),
  },
  // クリップボード関連API
  clipboardAPI: {
    checkCurrent: () => ipcInvoke(IPC_CHANNELS.CLIPBOARD_CHECK_CURRENT),
    capture: () => ipcInvoke(IPC_CHANNELS.CLIPBOARD_CAPTURE),
    restore: (dataFileRef) => ipcInvoke(IPC_CHANNELS.CLIPBOARD_RESTORE, dataFileRef),
    // セッション管理（登録確定前の一時保存）
    captureToSession: () => ipcInvoke(IPC_CHANNELS.CLIPBOARD_CAPTURE_TO_SESSION),
    commitSession: (sessionId) => ipcInvoke(IPC_CHANNELS.CLIPBOARD_COMMIT_SESSION, sessionId),
    discardSession: (sessionId) => ipcInvoke(IPC_CHANNELS.CLIPBOARD_DISCARD_SESSION, sessionId),
    saveText: (text) => ipcInvoke(IPC_CHANNELS.CLIPBOARD_SAVE_TEXT, text),
    readContent: (source) => ipcInvoke(IPC_CHANNELS.CLIPBOARD_READ_CONTENT, source),
    countUnusedData: () => ipcInvoke(IPC_CHANNELS.CLIPBOARD_COUNT_UNUSED_DATA),
    deleteUnusedData: () => ipcInvoke(IPC_CHANNELS.CLIPBOARD_DELETE_UNUSED_DATA),
  },
  // バックアップAPI
  backupAPI: {
    listSnapshots: () => ipcInvoke(IPC_CHANNELS.BACKUP_LIST_SNAPSHOTS),
    restoreSnapshot: (timestamp) => ipcInvoke(IPC_CHANNELS.BACKUP_RESTORE_SNAPSHOT, timestamp),
    deleteSnapshot: (timestamp) => ipcInvoke(IPC_CHANNELS.BACKUP_DELETE_SNAPSHOT, timestamp),
    getStatus: () => ipcInvoke(IPC_CHANNELS.BACKUP_GET_STATUS),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
