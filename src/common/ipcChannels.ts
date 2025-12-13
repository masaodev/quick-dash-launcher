/**
 * IPC通信チャネル定数
 * メインプロセスとレンダラープロセス間の通信で使用するチャネル名を定義
 */

// アイテム操作
export const OPEN_ITEM = 'open-item';
export const OPEN_PARENT_FOLDER = 'open-parent-folder';
export const EXECUTE_GROUP = 'execute-group';

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
export const LOAD_CACHED_ICONS = 'load-cached-icons';
export const LOAD_CACHED_ICONS_BY_ITEMS = 'load-cached-icons-by-items';
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
export const GET_INITIAL_TAB = 'get-initial-tab';
export const COPY_TO_CLIPBOARD = 'copy-to-clipboard';
export const LOG_PERFORMANCE_TIMING = 'log-performance-timing';

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

// ワークスペース - イベント
export const WORKSPACE_CHANGED = 'workspace-changed';

/**
 * すべてのIPCチャネル定数をまとめたオブジェクト
 * 型安全な使用のために利用可能
 */
export const IPC_CHANNELS = {
  // アイテム操作
  OPEN_ITEM,
  OPEN_PARENT_FOLDER,
  EXECUTE_GROUP,

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
  LOAD_CACHED_ICONS,
  LOAD_CACHED_ICONS_BY_ITEMS,
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
  GET_INITIAL_TAB,
  COPY_TO_CLIPBOARD,
  LOG_PERFORMANCE_TIMING,

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
} as const;

/**
 * IPCチャネル名の型
 */
export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
