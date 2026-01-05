/**
 * IPC通信チャネル定数
 * メインプロセスとレンダラープロセス間の通信で使用するチャネル名を定義
 */

// アイテム操作
export const OPEN_ITEM = 'open-item';
export const OPEN_PARENT_FOLDER = 'open-parent-folder';
export const EXECUTE_GROUP = 'execute-group';
export const EXECUTE_WINDOW_OPERATION = 'execute-window-operation';

// データ操作
export const LOAD_DATA_FILES = 'load-data-files';
export const LOAD_RAW_DATA_FILES = 'load-raw-data-files';
export const SAVE_RAW_DATA_FILES = 'save-raw-data-files';
export const REGISTER_ITEMS = 'register-items';
export const GET_CONFIG_FOLDER = 'get-config-folder';
export const GET_DATA_FILES = 'get-data-files';
export const CREATE_DATA_FILE = 'create-data-file';
export const DELETE_DATA_FILE = 'delete-data-file';
export const IS_DIRECTORY = 'is-directory';

// アイコン操作
export const FETCH_FAVICON = 'fetch-favicon';
export const EXTRACT_ICON = 'extract-icon';
export const EXTRACT_FILE_ICON_BY_EXTENSION = 'extract-file-icon-by-extension';
export const EXTRACT_CUSTOM_URI_ICON = 'extract-custom-uri-icon';
export const GET_ICON_FOR_ITEM = 'get-icon-for-item';
export const LOAD_CACHED_ICONS = 'load-cached-icons';
export const LOAD_CACHED_ICONS_BY_ITEMS = 'load-cached-icons-by-items';
export const FETCH_ICONS_COMBINED = 'fetch-icons-combined';
export const SELECT_CUSTOM_ICON_FILE = 'select-custom-icon-file';
export const SAVE_CUSTOM_ICON = 'save-custom-icon';
export const DELETE_CUSTOM_ICON = 'delete-custom-icon';
export const GET_CUSTOM_ICON = 'get-custom-icon';

// ブックマークインポート
export const SELECT_BOOKMARK_FILE = 'select-bookmark-file';
export const PARSE_BOOKMARK_FILE = 'parse-bookmark-file';
export const DETECT_INSTALLED_BROWSERS = 'detect-installed-browsers';
export const PARSE_BROWSER_BOOKMARKS = 'parse-browser-bookmarks';

// ウィンドウ操作
export const GET_WINDOW_PIN_MODE = 'get-window-pin-mode';
export const CYCLE_WINDOW_PIN_MODE = 'cycle-window-pin-mode';
export const QUIT_APP = 'quit-app';
export const SET_EDIT_MODE = 'set-edit-mode';
export const GET_EDIT_MODE = 'get-edit-mode';
export const SHOW_EDIT_WINDOW = 'show-edit-window';
export const HIDE_EDIT_WINDOW = 'hide-edit-window';
export const TOGGLE_EDIT_WINDOW = 'toggle-edit-window';
export const IS_EDIT_WINDOW_SHOWN = 'is-edit-window-shown';
export const OPEN_EDIT_WINDOW_WITH_TAB = 'open-edit-window-with-tab';
export const GET_INITIAL_TAB = 'get-initial-tab';
export const GET_ALL_WINDOWS = 'get-all-windows';
export const ACTIVATE_WINDOW = 'activate-window';
export const COPY_TO_CLIPBOARD = 'copy-to-clipboard';
export const SET_MODAL_MODE = 'set-modal-mode';
export const LOG_PERFORMANCE_TIMING = 'log-performance-timing';

// 編集操作
export const UPDATE_ITEM = 'update-item';
export const UPDATE_RAW_LINE = 'update-raw-line';
export const DELETE_ITEMS = 'delete-items';
export const BATCH_UPDATE_ITEMS = 'batch-update-items';

// 設定
export const SETTINGS_IS_FIRST_LAUNCH = 'settings:is-first-launch';
export const SETTINGS_GET = 'settings:get';
export const SETTINGS_SET = 'settings:set';
export const SETTINGS_SET_MULTIPLE = 'settings:set-multiple';
export const SETTINGS_RESET = 'settings:reset';
export const SETTINGS_VALIDATE_HOTKEY = 'settings:validate-hotkey';
export const SETTINGS_GET_CONFIG_PATH = 'settings:get-config-path';
export const SETTINGS_CHANGE_HOTKEY = 'settings:change-hotkey';
export const SETTINGS_CHECK_HOTKEY_AVAILABILITY = 'settings:check-hotkey-availability';

// 設定ファイル操作
export const OPEN_CONFIG_FOLDER = 'open-config-folder';
export const GET_APP_INFO = 'get-app-info';
export const OPEN_EXTERNAL_URL = 'open-external-url';

// スプラッシュ画面
export const SPLASH_READY = 'splash-ready';

// 検索履歴
export const LOAD_SEARCH_HISTORY = 'load-search-history';
export const LOAD_SEARCH_HISTORY_BY_TAB = 'load-search-history-by-tab';
export const SAVE_SEARCH_HISTORY = 'save-search-history';
export const ADD_SEARCH_HISTORY_ENTRY = 'add-search-history-entry';
export const CLEAR_SEARCH_HISTORY = 'clear-search-history';

// ワークスペース
export const WORKSPACE_LOAD_ITEMS = 'workspace:load-items';
export const WORKSPACE_ADD_ITEM = 'workspace:add-item';
export const WORKSPACE_ADD_ITEMS_FROM_PATHS = 'workspace:add-items-from-paths';
export const WORKSPACE_REMOVE_ITEM = 'workspace:remove-item';
export const WORKSPACE_UPDATE_DISPLAY_NAME = 'workspace:update-display-name';
export const WORKSPACE_REORDER_ITEMS = 'workspace:reorder-items';
export const WORKSPACE_LAUNCH_ITEM = 'workspace:launch-item';

// ワークスペース - ウィンドウ制御
export const WORKSPACE_TOGGLE_WINDOW = 'workspace:toggle-window';
export const WORKSPACE_SHOW_WINDOW = 'workspace:show-window';
export const WORKSPACE_HIDE_WINDOW = 'workspace:hide-window';
export const WORKSPACE_GET_ALWAYS_ON_TOP = 'workspace:get-always-on-top';
export const WORKSPACE_TOGGLE_ALWAYS_ON_TOP = 'workspace:toggle-always-on-top';
export const WORKSPACE_SET_SIZE = 'workspace:set-size';
export const WORKSPACE_SET_POSITION_AND_SIZE = 'workspace:set-position-and-size';
export const WORKSPACE_SET_MODAL_MODE = 'workspace:set-modal-mode';
export const WORKSPACE_SET_OPACITY = 'workspace:set-opacity';
export const WORKSPACE_GET_OPACITY = 'workspace:get-opacity';

// ワークスペース - グループ管理
export const WORKSPACE_LOAD_GROUPS = 'workspace:load-groups';
export const WORKSPACE_CREATE_GROUP = 'workspace:create-group';
export const WORKSPACE_UPDATE_GROUP = 'workspace:update-group';
export const WORKSPACE_DELETE_GROUP = 'workspace:delete-group';
export const WORKSPACE_REORDER_GROUPS = 'workspace:reorder-groups';
export const WORKSPACE_MOVE_ITEM_TO_GROUP = 'workspace:move-item-to-group';

// ワークスペース - 実行履歴
export const WORKSPACE_LOAD_EXECUTION_HISTORY = 'workspace:load-execution-history';
export const WORKSPACE_ADD_EXECUTION_HISTORY = 'workspace:add-execution-history';
export const WORKSPACE_CLEAR_EXECUTION_HISTORY = 'workspace:clear-execution-history';

// ワークスペース - アーカイブ管理
export const WORKSPACE_ARCHIVE_GROUP = 'workspace:archive-group';
export const WORKSPACE_LOAD_ARCHIVED_GROUPS = 'workspace:load-archived-groups';
export const WORKSPACE_RESTORE_GROUP = 'workspace:restore-group';
export const WORKSPACE_DELETE_ARCHIVED_GROUP = 'workspace:delete-archived-group';

// ワークスペース - イベント
export const WORKSPACE_CHANGED = 'workspace-changed';

// 管理ウィンドウ
export const ADMIN_SHOW_ARCHIVE_TAB = 'admin:show-archive-tab';

// イベント（メインプロセスからレンダラーへの通知）
export const EVENT_WINDOW_SHOWN = 'window-shown';
export const EVENT_WINDOW_HIDDEN = 'window-hidden';
export const EVENT_DATA_CHANGED = 'data-changed';
export const EVENT_SETTINGS_CHANGED = 'settings-changed';
export const EVENT_SET_ACTIVE_TAB = 'set-active-tab';
export const EVENT_ICON_PROGRESS_START = 'icon-progress-start';
export const EVENT_ICON_PROGRESS_UPDATE = 'icon-progress-update';
export const EVENT_ICON_PROGRESS_COMPLETE = 'icon-progress-complete';

/**
 * すべてのIPCチャネル定数をまとめたオブジェクト
 * 型安全な使用のために利用可能
 */
export const IPC_CHANNELS = {
  // アイテム操作
  OPEN_ITEM,
  OPEN_PARENT_FOLDER,
  EXECUTE_GROUP,
  EXECUTE_WINDOW_OPERATION,

  // データ操作
  LOAD_DATA_FILES,
  LOAD_RAW_DATA_FILES,
  SAVE_RAW_DATA_FILES,
  REGISTER_ITEMS,
  GET_CONFIG_FOLDER,
  GET_DATA_FILES,
  CREATE_DATA_FILE,
  DELETE_DATA_FILE,
  IS_DIRECTORY,

  // アイコン操作
  FETCH_FAVICON,
  EXTRACT_ICON,
  EXTRACT_FILE_ICON_BY_EXTENSION,
  EXTRACT_CUSTOM_URI_ICON,
  GET_ICON_FOR_ITEM,
  LOAD_CACHED_ICONS,
  LOAD_CACHED_ICONS_BY_ITEMS,
  FETCH_ICONS_COMBINED,
  SELECT_CUSTOM_ICON_FILE,
  SAVE_CUSTOM_ICON,
  DELETE_CUSTOM_ICON,
  GET_CUSTOM_ICON,

  // ブックマークインポート
  SELECT_BOOKMARK_FILE,
  PARSE_BOOKMARK_FILE,
  DETECT_INSTALLED_BROWSERS,
  PARSE_BROWSER_BOOKMARKS,

  // ウィンドウ操作
  GET_WINDOW_PIN_MODE,
  CYCLE_WINDOW_PIN_MODE,
  QUIT_APP,
  SET_EDIT_MODE,
  GET_EDIT_MODE,
  SHOW_EDIT_WINDOW,
  HIDE_EDIT_WINDOW,
  TOGGLE_EDIT_WINDOW,
  IS_EDIT_WINDOW_SHOWN,
  OPEN_EDIT_WINDOW_WITH_TAB,
  GET_INITIAL_TAB,
  GET_ALL_WINDOWS,
  ACTIVATE_WINDOW,
  COPY_TO_CLIPBOARD,
  SET_MODAL_MODE,
  LOG_PERFORMANCE_TIMING,

  // 編集操作
  UPDATE_ITEM,
  UPDATE_RAW_LINE,
  DELETE_ITEMS,
  BATCH_UPDATE_ITEMS,

  // 設定
  SETTINGS_IS_FIRST_LAUNCH,
  SETTINGS_GET,
  SETTINGS_SET,
  SETTINGS_SET_MULTIPLE,
  SETTINGS_RESET,
  SETTINGS_VALIDATE_HOTKEY,
  SETTINGS_GET_CONFIG_PATH,
  SETTINGS_CHANGE_HOTKEY,
  SETTINGS_CHECK_HOTKEY_AVAILABILITY,

  // 設定ファイル操作
  OPEN_CONFIG_FOLDER,
  GET_APP_INFO,
  OPEN_EXTERNAL_URL,

  // スプラッシュ画面
  SPLASH_READY,

  // 検索履歴
  LOAD_SEARCH_HISTORY,
  LOAD_SEARCH_HISTORY_BY_TAB,
  SAVE_SEARCH_HISTORY,
  ADD_SEARCH_HISTORY_ENTRY,
  CLEAR_SEARCH_HISTORY,

  // ワークスペース
  WORKSPACE_LOAD_ITEMS,
  WORKSPACE_ADD_ITEM,
  WORKSPACE_ADD_ITEMS_FROM_PATHS,
  WORKSPACE_REMOVE_ITEM,
  WORKSPACE_UPDATE_DISPLAY_NAME,
  WORKSPACE_REORDER_ITEMS,
  WORKSPACE_LAUNCH_ITEM,

  // ワークスペース - ウィンドウ制御
  WORKSPACE_TOGGLE_WINDOW,
  WORKSPACE_SHOW_WINDOW,
  WORKSPACE_HIDE_WINDOW,
  WORKSPACE_GET_ALWAYS_ON_TOP,
  WORKSPACE_TOGGLE_ALWAYS_ON_TOP,
  WORKSPACE_SET_SIZE,
  WORKSPACE_SET_POSITION_AND_SIZE,
  WORKSPACE_SET_MODAL_MODE,
  WORKSPACE_SET_OPACITY,
  WORKSPACE_GET_OPACITY,

  // ワークスペース - グループ管理
  WORKSPACE_LOAD_GROUPS,
  WORKSPACE_CREATE_GROUP,
  WORKSPACE_UPDATE_GROUP,
  WORKSPACE_DELETE_GROUP,
  WORKSPACE_REORDER_GROUPS,
  WORKSPACE_MOVE_ITEM_TO_GROUP,

  // ワークスペース - 実行履歴
  WORKSPACE_LOAD_EXECUTION_HISTORY,
  WORKSPACE_ADD_EXECUTION_HISTORY,
  WORKSPACE_CLEAR_EXECUTION_HISTORY,

  // ワークスペース - アーカイブ管理
  WORKSPACE_ARCHIVE_GROUP,
  WORKSPACE_LOAD_ARCHIVED_GROUPS,
  WORKSPACE_RESTORE_GROUP,
  WORKSPACE_DELETE_ARCHIVED_GROUP,

  // 管理ウィンドウ
  ADMIN_SHOW_ARCHIVE_TAB,

  // ワークスペース - イベント
  WORKSPACE_CHANGED,

  // イベント
  EVENT_WINDOW_SHOWN,
  EVENT_WINDOW_HIDDEN,
  EVENT_DATA_CHANGED,
  EVENT_SETTINGS_CHANGED,
  EVENT_SET_ACTIVE_TAB,
  EVENT_ICON_PROGRESS_START,
  EVENT_ICON_PROGRESS_UPDATE,
  EVENT_ICON_PROGRESS_COMPLETE,
} as const;

/**
 * IPCチャネル名の型
 */
export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
