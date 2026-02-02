/**
 * IPC通信チャネル定数
 * メインプロセスとレンダラープロセス間の通信で使用するチャネル名を定義
 */

/**
 * すべてのIPCチャネル定数をまとめたオブジェクト
 * 型安全な使用のために利用可能
 */
export const IPC_CHANNELS = {
  // アイテム操作
  OPEN_ITEM: 'open-item',
  OPEN_PARENT_FOLDER: 'open-parent-folder',
  EXECUTE_GROUP: 'execute-group',
  EXECUTE_WINDOW_OPERATION: 'execute-window-operation',

  // データ操作
  LOAD_DATA_FILES: 'load-data-files',
  LOAD_EDITABLE_ITEMS: 'load-editable-items',
  SAVE_EDITABLE_ITEMS: 'save-editable-items',
  REGISTER_ITEMS: 'register-items',
  GET_CONFIG_FOLDER: 'get-config-folder',
  GET_DATA_FILES: 'get-data-files',
  CREATE_DATA_FILE: 'create-data-file',
  DELETE_DATA_FILE: 'delete-data-file',
  IS_DIRECTORY: 'is-directory',

  // アイコン操作
  FETCH_FAVICON: 'fetch-favicon',
  EXTRACT_ICON: 'extract-icon',
  EXTRACT_FILE_ICON_BY_EXTENSION: 'extract-file-icon-by-extension',
  EXTRACT_CUSTOM_URI_ICON: 'extract-custom-uri-icon',
  GET_ICON_FOR_ITEM: 'get-icon-for-item',
  LOAD_CACHED_ICONS: 'load-cached-icons',
  LOAD_CACHED_ICONS_BY_ITEMS: 'load-cached-icons-by-items',
  FETCH_ICONS_COMBINED: 'fetch-icons-combined',
  CLEAR_ICON_FETCH_ERRORS: 'clear-icon-fetch-errors',
  GET_ICON_FETCH_ERRORS: 'get-icon-fetch-errors',
  SELECT_CUSTOM_ICON_FILE: 'select-custom-icon-file',
  SAVE_CUSTOM_ICON: 'save-custom-icon',
  DELETE_CUSTOM_ICON: 'delete-custom-icon',
  GET_CUSTOM_ICON: 'get-custom-icon',

  // ブックマークインポート
  SELECT_BOOKMARK_FILE: 'select-bookmark-file',
  PARSE_BOOKMARK_FILE: 'parse-bookmark-file',
  DETECT_INSTALLED_BROWSERS: 'detect-installed-browsers',
  PARSE_BROWSER_BOOKMARKS: 'parse-browser-bookmarks',

  // ウィンドウ操作
  GET_WINDOW_PIN_MODE: 'get-window-pin-mode',
  CYCLE_WINDOW_PIN_MODE: 'cycle-window-pin-mode',
  QUIT_APP: 'quit-app',
  SET_EDIT_MODE: 'set-edit-mode',
  GET_EDIT_MODE: 'get-edit-mode',
  SHOW_EDIT_WINDOW: 'show-edit-window',
  HIDE_EDIT_WINDOW: 'hide-edit-window',
  TOGGLE_EDIT_WINDOW: 'toggle-edit-window',
  IS_EDIT_WINDOW_SHOWN: 'is-edit-window-shown',
  OPEN_EDIT_WINDOW_WITH_TAB: 'open-edit-window-with-tab',
  GET_INITIAL_TAB: 'get-initial-tab',
  GET_ALL_WINDOWS: 'get-all-windows',
  GET_ALL_WINDOWS_ALL_DESKTOPS: 'get-all-windows-all-desktops',
  GET_VIRTUAL_DESKTOP_INFO: 'get-virtual-desktop-info',
  ACTIVATE_WINDOW: 'activate-window',
  COPY_TO_CLIPBOARD: 'copy-to-clipboard',
  SET_MODAL_MODE: 'set-modal-mode',
  LOG_PERFORMANCE_TIMING: 'log-performance-timing',

  // 編集操作（IDベース）
  UPDATE_ITEM_BY_ID: 'update-item-by-id',
  UPDATE_DIR_ITEM_BY_ID: 'update-dir-item-by-id',
  UPDATE_GROUP_ITEM_BY_ID: 'update-group-item-by-id',
  UPDATE_WINDOW_ITEM_BY_ID: 'update-window-item-by-id',
  DELETE_ITEMS_BY_ID: 'delete-items-by-id',
  BATCH_UPDATE_ITEMS_BY_ID: 'batch-update-items-by-id',

  // 設定
  SETTINGS_IS_FIRST_LAUNCH: 'settings:is-first-launch',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_SET_MULTIPLE: 'settings:set-multiple',
  SETTINGS_RESET: 'settings:reset',
  SETTINGS_VALIDATE_HOTKEY: 'settings:validate-hotkey',
  SETTINGS_GET_CONFIG_PATH: 'settings:get-config-path',
  SETTINGS_CHANGE_HOTKEY: 'settings:change-hotkey',
  SETTINGS_CHECK_HOTKEY_AVAILABILITY: 'settings:check-hotkey-availability',
  SETTINGS_CHANGE_ITEM_SEARCH_HOTKEY: 'settings:change-item-search-hotkey',
  SETTINGS_GET_DISPLAYS: 'settings:get-displays',

  // 設定ファイル操作
  OPEN_CONFIG_FOLDER: 'open-config-folder',
  GET_APP_INFO: 'get-app-info',
  OPEN_EXTERNAL_URL: 'open-external-url',

  // スプラッシュ画面
  SPLASH_READY: 'splash-ready',

  // 検索履歴
  LOAD_SEARCH_HISTORY: 'load-search-history',
  LOAD_SEARCH_HISTORY_BY_TAB: 'load-search-history-by-tab',
  SAVE_SEARCH_HISTORY: 'save-search-history',
  ADD_SEARCH_HISTORY_ENTRY: 'add-search-history-entry',
  CLEAR_SEARCH_HISTORY: 'clear-search-history',

  // ワークスペース
  WORKSPACE_LOAD_ITEMS: 'workspace:load-items',
  WORKSPACE_ADD_ITEM: 'workspace:add-item',
  WORKSPACE_ADD_ITEMS_FROM_PATHS: 'workspace:add-items-from-paths',
  WORKSPACE_REMOVE_ITEM: 'workspace:remove-item',
  WORKSPACE_UPDATE_DISPLAY_NAME: 'workspace:update-display-name',
  WORKSPACE_UPDATE_ITEM: 'workspace:update-item',
  WORKSPACE_REORDER_ITEMS: 'workspace:reorder-items',
  WORKSPACE_LAUNCH_ITEM: 'workspace:launch-item',

  // ワークスペース - ウィンドウ制御
  WORKSPACE_TOGGLE_WINDOW: 'workspace:toggle-window',
  WORKSPACE_SHOW_WINDOW: 'workspace:show-window',
  WORKSPACE_HIDE_WINDOW: 'workspace:hide-window',
  WORKSPACE_GET_ALWAYS_ON_TOP: 'workspace:get-always-on-top',
  WORKSPACE_TOGGLE_ALWAYS_ON_TOP: 'workspace:toggle-always-on-top',
  WORKSPACE_SET_SIZE: 'workspace:set-size',
  WORKSPACE_SET_POSITION_AND_SIZE: 'workspace:set-position-and-size',
  WORKSPACE_SET_POSITION_MODE: 'workspace:set-position-mode',
  WORKSPACE_SET_MODAL_MODE: 'workspace:set-modal-mode',
  WORKSPACE_SET_OPACITY: 'workspace:set-opacity',
  WORKSPACE_GET_OPACITY: 'workspace:get-opacity',

  // ワークスペース - グループ管理
  WORKSPACE_LOAD_GROUPS: 'workspace:load-groups',
  WORKSPACE_CREATE_GROUP: 'workspace:create-group',
  WORKSPACE_UPDATE_GROUP: 'workspace:update-group',
  WORKSPACE_DELETE_GROUP: 'workspace:delete-group',
  WORKSPACE_REORDER_GROUPS: 'workspace:reorder-groups',
  WORKSPACE_MOVE_ITEM_TO_GROUP: 'workspace:move-item-to-group',

  // ワークスペース - 実行履歴
  WORKSPACE_LOAD_EXECUTION_HISTORY: 'workspace:load-execution-history',
  WORKSPACE_ADD_EXECUTION_HISTORY: 'workspace:add-execution-history',
  WORKSPACE_CLEAR_EXECUTION_HISTORY: 'workspace:clear-execution-history',

  // ワークスペース - アーカイブ管理
  WORKSPACE_ARCHIVE_GROUP: 'workspace:archive-group',
  WORKSPACE_LOAD_ARCHIVED_GROUPS: 'workspace:load-archived-groups',
  WORKSPACE_RESTORE_GROUP: 'workspace:restore-group',
  WORKSPACE_DELETE_ARCHIVED_GROUP: 'workspace:delete-archived-group',

  // ワークスペース - イベント
  WORKSPACE_CHANGED: 'workspace-changed',

  // 管理ウィンドウ
  ADMIN_SHOW_ARCHIVE_TAB: 'admin:show-archive-tab',

  // システム通知
  SHOW_NOTIFICATION: 'show-notification',
  SHOW_TOAST_WINDOW: 'show-toast-window',
  EVENT_SHOW_TOAST: 'show-toast',

  // イベント（メインプロセスからレンダラーへの通知）
  EVENT_WINDOW_SHOWN: 'window-shown',
  EVENT_WINDOW_SHOWN_ITEM_SEARCH: 'window-shown-item-search',
  EVENT_WINDOW_HIDDEN: 'window-hidden',
  EVENT_DATA_CHANGED: 'data-changed',
  EVENT_SETTINGS_CHANGED: 'settings-changed',
  EVENT_SET_ACTIVE_TAB: 'set-active-tab',
  EVENT_ICON_PROGRESS_START: 'icon-progress-start',
  EVENT_ICON_PROGRESS_UPDATE: 'icon-progress-update',
  EVENT_ICON_PROGRESS_COMPLETE: 'icon-progress-complete',

  // コンテキストメニュー - Admin
  SHOW_ADMIN_ITEM_CONTEXT_MENU: 'show-admin-item-context-menu',
  EVENT_ADMIN_MENU_DUPLICATE_ITEMS: 'admin-menu-duplicate-items',
  EVENT_ADMIN_MENU_EDIT_ITEM: 'admin-menu-edit-item',
  EVENT_ADMIN_MENU_DELETE_ITEMS: 'admin-menu-delete-items',

  // コンテキストメニュー - Launcher
  SHOW_LAUNCHER_CONTEXT_MENU: 'show-launcher-context-menu',
  EVENT_LAUNCHER_MENU_EDIT_ITEM: 'launcher-menu-edit-item',
  EVENT_LAUNCHER_MENU_ADD_TO_WORKSPACE: 'launcher-menu-add-to-workspace',
  EVENT_LAUNCHER_MENU_COPY_PATH: 'launcher-menu-copy-path',
  EVENT_LAUNCHER_MENU_COPY_PARENT_PATH: 'launcher-menu-copy-parent-path',
  EVENT_LAUNCHER_MENU_OPEN_PARENT_FOLDER: 'launcher-menu-open-parent-folder',
  EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PATH: 'launcher-menu-copy-shortcut-path',
  EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PARENT_PATH: 'launcher-menu-copy-shortcut-parent-path',
  EVENT_LAUNCHER_MENU_OPEN_SHORTCUT_PARENT_FOLDER: 'launcher-menu-open-shortcut-parent-folder',

  // コンテキストメニュー - Workspace
  SHOW_WORKSPACE_CONTEXT_MENU: 'show-workspace-context-menu',
  EVENT_WORKSPACE_MENU_RENAME_ITEM: 'workspace-menu-rename-item',
  EVENT_WORKSPACE_MENU_EDIT_ITEM: 'workspace-menu-edit-item',
  EVENT_WORKSPACE_MENU_LAUNCH_ITEM: 'workspace-menu-launch-item',
  EVENT_WORKSPACE_MENU_COPY_PATH: 'workspace-menu-copy-path',
  EVENT_WORKSPACE_MENU_COPY_PARENT_PATH: 'workspace-menu-copy-parent-path',
  EVENT_WORKSPACE_MENU_OPEN_PARENT_FOLDER: 'workspace-menu-open-parent-folder',
  EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PATH: 'workspace-menu-copy-shortcut-path',
  EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PARENT_PATH: 'workspace-menu-copy-shortcut-parent-path',
  EVENT_WORKSPACE_MENU_OPEN_SHORTCUT_PARENT_FOLDER: 'workspace-menu-open-shortcut-parent-folder',
  EVENT_WORKSPACE_MENU_REMOVE_FROM_GROUP: 'workspace-menu-remove-from-group',
  EVENT_WORKSPACE_MENU_REMOVE_ITEM: 'workspace-menu-remove-item',

  // コンテキストメニュー - Workspace Group
  SHOW_WORKSPACE_GROUP_CONTEXT_MENU: 'show-workspace-group-context-menu',
  EVENT_WORKSPACE_GROUP_MENU_RENAME: 'workspace-group-menu-rename',
  EVENT_WORKSPACE_GROUP_MENU_SHOW_COLOR_PICKER: 'workspace-group-menu-show-color-picker',
  EVENT_WORKSPACE_GROUP_MENU_CHANGE_COLOR: 'workspace-group-menu-change-color',
  EVENT_WORKSPACE_GROUP_MENU_COPY_AS_TEXT: 'workspace-group-menu-copy-as-text',
  EVENT_WORKSPACE_GROUP_MENU_ARCHIVE: 'workspace-group-menu-archive',
  EVENT_WORKSPACE_GROUP_MENU_DELETE: 'workspace-group-menu-delete',

  // コンテキストメニュー - Window
  SHOW_WINDOW_CONTEXT_MENU: 'show-window-context-menu',
  EVENT_WINDOW_MENU_ACTIVATE: 'window-menu-activate',
  MOVE_WINDOW_TO_DESKTOP: 'move-window-to-desktop',
  PIN_WINDOW: 'pin-window',
  UNPIN_WINDOW: 'unpin-window',
  IS_WINDOW_PINNED: 'is-window-pinned',

  // クリップボード操作
  CLIPBOARD_CAPTURE: 'clipboard:capture',
  CLIPBOARD_RESTORE: 'clipboard:restore',
  CLIPBOARD_DELETE_DATA: 'clipboard:delete-data',
  CLIPBOARD_GET_PREVIEW: 'clipboard:get-preview',
  CLIPBOARD_CHECK_CURRENT: 'clipboard:check-current',
} as const;

/**
 * IPCチャネル名の型
 */
export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
