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
  RUN_ITEM_AS_ADMIN: 'run-item-as-admin',
  EXECUTE_SET: 'execute-set',

  // データ操作
  LOAD_DATA_FILES: 'load-data-files',
  LOAD_EDITABLE_ITEMS: 'load-editable-items',
  SAVE_EDITABLE_ITEMS: 'save-editable-items',
  REGISTER_ITEMS: 'register-items',
  GET_CONFIG_FOLDER: 'get-config-folder',
  GET_DATA_FILES: 'get-data-files',
  CREATE_DATA_FILE: 'create-data-file',
  DELETE_DATA_FILE: 'delete-data-file',
  /** パスがフォルダ・ファイル・存在しないのどれかを確かめる（登録画面へのドロップ） */
  PATH_GET_KIND: 'path:get-kind',
  /** ファイルかフォルダを選ぶダイアログを開く（登録・編集画面のパス欄の「選択」） */
  PATH_SELECT: 'path:select',
  /** フォルダ取込で何が並ぶかを走査する（登録・編集画面のプレビュー） */
  DIR_PREVIEW_RUN: 'dir-preview:run',
  /** 走査中のプレビューをやめる */
  DIR_PREVIEW_CANCEL: 'dir-preview:cancel',
  /** パスが実在するかをまとめて確認する（アイテム管理のリンク切れ表示） */
  CHECK_PATHS_EXIST: 'check-paths-exist',
  /** アイテムを起動した記録（アイテム管理の最終起動・起動回数） */
  GET_LAUNCH_USAGE: 'launch-usage:get',
  /** アイテム管理の CSV を保存先を選んで書く */
  ITEMS_CSV_EXPORT: 'items-csv:export',
  /** アイテム管理に取り込む CSV を選んで読む */
  ITEMS_CSV_READ: 'items-csv:read',
  /** 既定のブラウザの exe と表示名（登録・編集画面の「変換」） */
  BROWSER_GET_DEFAULT: 'browser:get-default',
  /** 拡張子に関連付けられたプログラムの exe と表示名（登録・編集画面の「変換」） */
  FILE_GET_HANDLER: 'file:get-handler',

  // アイコン操作
  FETCH_FAVICON: 'fetch-favicon',
  EXTRACT_ICON: 'extract-icon',
  GET_ICON_FOR_ITEM: 'get-icon-for-item',
  LOAD_CACHED_ICONS: 'load-cached-icons',
  FETCH_ICONS_COMBINED: 'fetch-icons-combined',
  ENSURE_ICONS: 'ensure-icons',
  /** 管理ウィンドウなどから、メインウィンドウに未取得のアイコンの取得を頼む（ブックマーク取込の後。A3-174） */
  REQUEST_FETCH_MISSING_ICONS: 'request-fetch-missing-icons',
  EVENT_FETCH_MISSING_ICONS_REQUESTED: 'fetch-missing-icons-requested',
  GET_ICON_FETCH_ERRORS: 'get-icon-fetch-errors',
  SELECT_CUSTOM_ICON_FILE: 'select-custom-icon-file',
  SAVE_CUSTOM_ICON: 'save-custom-icon',
  DELETE_CUSTOM_ICON: 'delete-custom-icon',
  GET_CUSTOM_ICON: 'get-custom-icon',

  // ブックマークインポート
  SELECT_BOOKMARK_FILE: 'select-bookmark-file',
  PARSE_BOOKMARK_FILE_WITH_FOLDERS: 'parse-bookmark-file-with-folders',
  DETECT_INSTALLED_BROWSERS: 'detect-installed-browsers',

  // アプリインポート
  SCAN_INSTALLED_APPS: 'scan-installed-apps',
  /** アプリのスキャンの途中経過（ここまでに見つけた件数） */
  EVENT_APP_SCAN_PROGRESS: 'app-scan-progress',

  // ブックマーク自動取込
  BOOKMARK_AUTO_IMPORT_GET_SETTINGS: 'bookmark-auto-import:get-settings',
  BOOKMARK_AUTO_IMPORT_SAVE_SETTINGS: 'bookmark-auto-import:save-settings',
  BOOKMARK_AUTO_IMPORT_EXECUTE_RULE: 'bookmark-auto-import:execute-rule',
  BOOKMARK_AUTO_IMPORT_EXECUTE_ALL: 'bookmark-auto-import:execute-all',
  BOOKMARK_AUTO_IMPORT_GET_BOOKMARKS_WITH_FOLDERS:
    'bookmark-auto-import:get-bookmarks-with-folders',
  BOOKMARK_AUTO_IMPORT_DELETE_RULE_ITEMS: 'bookmark-auto-import:delete-rule-items',

  // バックアップ
  BACKUP_LIST_SNAPSHOTS: 'backup:list-snapshots',
  BACKUP_RESTORE_SNAPSHOT: 'backup:restore-snapshot',
  BACKUP_DELETE_SNAPSHOT: 'backup:delete-snapshot',
  BACKUP_GET_STATUS: 'backup:get-status',

  // ウィンドウ操作
  // ピン留め（送ってきたウィンドウ＝メイン・ワークスペース・切り離しのどれかを対象にする）
  PIN_GET: 'pin:get',
  PIN_SET: 'pin:set',
  PIN_SHOW_MENU: 'pin:show-menu',
  EVENT_PIN_CHANGED: 'pin-changed',
  WINDOW_SET_ESCAPE_HANDLED_BY_PAGE: 'window:set-escape-handled-by-page',
  WINDOW_START_MOVE: 'window:start-move',
  QUIT_APP: 'quit-app',
  HIDE_EDIT_WINDOW: 'hide-edit-window',
  TOGGLE_EDIT_WINDOW: 'toggle-edit-window',
  OPEN_EDIT_WINDOW_WITH_TAB: 'open-edit-window-with-tab',
  OPEN_EDIT_WINDOW_WITH_IMPORT_MODAL: 'open-edit-window-with-import-modal',
  GET_PENDING_IMPORT_MODAL: 'get-pending-import-modal',
  GET_INITIAL_TAB: 'get-initial-tab',
  GET_ALL_WINDOWS: 'get-all-windows',
  GET_ALL_WINDOWS_ALL_DESKTOPS: 'get-all-windows-all-desktops',
  GET_VIRTUAL_DESKTOP_INFO: 'get-virtual-desktop-info',
  ACTIVATE_WINDOW: 'activate-window',
  COPY_TO_CLIPBOARD: 'copy-to-clipboard',
  // メイン画面の子ウィンドウ（アイテムの登録・編集、アイコン取得結果）
  OPEN_MAIN_CHILD_WINDOW: 'window:open-main-child',
  GET_MAIN_CHILD_WINDOW_REQUEST: 'window:get-main-child-request',
  NOTIFY_MAIN_CHILD_WINDOW_RESULT: 'window:notify-main-child-result',
  RETURN_MAIN_CHILD_WINDOW_VALUE: 'window:return-main-child-value',
  EVENT_MAIN_CHILD_WINDOW_RESULT: 'window:main-child-result',
  LOG_PERFORMANCE_TIMING: 'log-performance-timing',

  // 編集操作（IDベース）
  UPDATE_ITEM_BY_ID: 'update-item-by-id',
  UPDATE_DIR_ITEM_BY_ID: 'update-dir-item-by-id',
  UPDATE_SET_ITEM_BY_ID: 'update-set-item-by-id',
  DELETE_ITEMS_BY_ID: 'delete-items-by-id',

  // 設定
  SETTINGS_IS_FIRST_LAUNCH: 'settings:is-first-launch',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET_MULTIPLE: 'settings:set-multiple',
  SETTINGS_RESET: 'settings:reset',
  SETTINGS_REAPPLY: 'settings:reapply',
  SETTINGS_VALIDATE_HOTKEY: 'settings:validate-hotkey',
  SETTINGS_CHANGE_HOTKEY: 'settings:change-hotkey',
  SETTINGS_CHANGE_ITEM_SEARCH_HOTKEY: 'settings:change-item-search-hotkey',
  SETTINGS_IS_ITEM_SEARCH_HOTKEY_AVAILABLE: 'settings:is-item-search-hotkey-available',
  SETTINGS_SET_HOTKEY_RECORDING: 'settings:set-hotkey-recording',
  SETTINGS_GET_DISPLAYS: 'settings:get-displays',
  GET_SCREEN_AREAS: 'get-screen-areas',
  SETTINGS_GET_AUTO_LAUNCH_STATUS: 'settings:get-auto-launch-status',
  /** 今の表示言語（設定 language と OS の表示言語から決めたもの。'ja' | 'en'） */
  SETTINGS_GET_LANGUAGE: 'settings:get-language',

  // 設定ファイル操作
  OPEN_CONFIG_FOLDER: 'open-config-folder',
  GET_APP_INFO: 'get-app-info',
  OPEN_EXTERNAL_URL: 'open-external-url',
  SHELL_OPEN_FOLDER: 'shell:open-folder',

  // スプラッシュ画面
  SPLASH_READY: 'splash-ready',
  SPLASH_INIT_COMPLETE: 'splash:init-complete',
  RENDERER_READY: 'renderer-ready',

  // 検索履歴
  LOAD_SEARCH_HISTORY: 'load-search-history',
  ADD_SEARCH_HISTORY_ENTRY: 'add-search-history-entry',
  CLEAR_SEARCH_HISTORY: 'clear-search-history',

  // ワークスペース
  WORKSPACE_LOAD_ITEMS: 'workspace:load-items',
  WORKSPACE_ADD_ITEM: 'workspace:add-item',
  WORKSPACE_CREATE_ITEM: 'workspace:create-item',
  WORKSPACE_ADD_ITEMS_FROM_PATHS: 'workspace:add-items-from-paths',
  WORKSPACE_REMOVE_ITEM: 'workspace:remove-item',
  WORKSPACE_UPDATE_DISPLAY_NAME: 'workspace:update-display-name',
  WORKSPACE_UPDATE_ITEM: 'workspace:update-item',
  WORKSPACE_LAUNCH_ITEM: 'workspace:launch-item',
  WORKSPACE_CONVERT_TO_COPY: 'workspace:convert-to-copy',
  WORKSPACE_LINK_TO_MAIN: 'workspace:link-to-main',
  WORKSPACE_MOVE_TO_MAIN: 'workspace:move-to-main',
  WORKSPACE_FIND_LINK_CANDIDATES: 'workspace:find-link-candidates',
  WORKSPACE_PREVIEW_LINK_COPIES: 'workspace:preview-link-copies',
  WORKSPACE_APPLY_LINK_COPIES: 'workspace:apply-link-copies',
  WORKSPACE_COUNT_REFS: 'workspace:count-refs',
  WORKSPACE_REMAP_REFS: 'workspace:remap-refs',
  WORKSPACE_OPEN_LINK_PICKER: 'workspace:open-link-picker',
  WORKSPACE_OPEN_LINK_COPIES: 'workspace:open-link-copies',

  // ワークスペース - ウィンドウ制御
  WORKSPACE_TOGGLE_WINDOW: 'workspace:toggle-window',
  WORKSPACE_HIDE_WINDOW: 'workspace:hide-window',
  WORKSPACE_IS_OPEN: 'workspace:is-open',
  WORKSPACE_GET_ALWAYS_ON_TOP: 'workspace:get-always-on-top',
  WORKSPACE_TOGGLE_ALWAYS_ON_TOP: 'workspace:toggle-always-on-top',
  WORKSPACE_SET_HEIGHT: 'workspace:set-height',
  WORKSPACE_SET_POSITION_AND_SIZE: 'workspace:set-position-and-size',
  WORKSPACE_SET_POSITION_MODE: 'workspace:set-position-mode',
  WORKSPACE_OPEN_CONFIRM: 'workspace:open-confirm',
  WORKSPACE_GET_CONFIRM_REQUEST: 'workspace:get-confirm-request',
  WORKSPACE_RETURN_CONFIRM_RESULT: 'workspace:return-confirm-result',
  WORKSPACE_OPEN_ITEM_EDITOR: 'workspace:open-item-editor',
  WORKSPACE_OPEN_ITEM_PICKER: 'workspace:open-item-picker',
  WORKSPACE_OPEN_NEW_ITEM_EDITOR: 'workspace:open-new-item-editor',

  // ワークスペース - グループ管理
  WORKSPACE_LOAD_GROUPS: 'workspace:load-groups',
  WORKSPACE_CREATE_GROUP: 'workspace:create-group',
  /** グループをサブグループとアイテムごと複製する */
  WORKSPACE_DUPLICATE_GROUP: 'workspace:duplicate-group',
  WORKSPACE_UPDATE_GROUP: 'workspace:update-group',
  WORKSPACE_DELETE_GROUP: 'workspace:delete-group',
  WORKSPACE_REORDER_MIXED: 'workspace:reorder-mixed',
  WORKSPACE_DUPLICATE_ITEM: 'workspace:duplicate-item',
  WORKSPACE_MOVE_ITEM_TO_GROUP: 'workspace:move-item-to-group',
  WORKSPACE_MOVE_GROUP_TO_PARENT: 'workspace:move-group-to-parent',
  WORKSPACE_SET_GROUPS_COLLAPSED: 'workspace:set-groups-collapsed',

  // ワークスペース - アーカイブ管理
  WORKSPACE_ARCHIVE_GROUP: 'workspace:archive-group',
  WORKSPACE_LOAD_ARCHIVED_GROUPS: 'workspace:load-archived-groups',
  WORKSPACE_LOAD_ARCHIVED_ITEMS: 'workspace:load-archived-items',
  WORKSPACE_DELETE_ARCHIVED_GROUP: 'workspace:delete-archived-group',

  // ワークスペース - 切り離しウィンドウ
  WORKSPACE_DETACH_GROUP: 'workspace:detach-group',
  WORKSPACE_CLOSE_DETACHED_GROUP: 'workspace:close-detached-group',
  WORKSPACE_RESIZE_CALLER_WINDOW: 'workspace:resize-caller-window',
  WORKSPACE_SET_CALLER_BOUNDS: 'workspace:set-caller-bounds',
  WORKSPACE_LOAD_DETACHED_STATE: 'workspace:load-detached-state',
  WORKSPACE_SAVE_DETACHED_COLLAPSED: 'workspace:save-detached-collapsed',

  // ワークスペース - ワークスペース（タブ）管理
  WORKSPACE_LOAD_WORKSPACES: 'workspace:load-workspaces',
  WORKSPACE_CREATE_WORKSPACE: 'workspace:create-workspace',
  WORKSPACE_RENAME_WORKSPACE: 'workspace:rename-workspace',
  WORKSPACE_DELETE_WORKSPACE: 'workspace:delete-workspace',
  WORKSPACE_REORDER_WORKSPACES: 'workspace:reorder-workspaces',

  // ワークスペース - アイテム/グループのワークスペース間移動
  WORKSPACE_MOVE_ITEM_TO_WORKSPACE: 'workspace:move-item-to-workspace',
  WORKSPACE_MOVE_GROUP_TO_WORKSPACE: 'workspace:move-group-to-workspace',

  // 子ウィンドウ生成（レンダラープロセス共有）
  /** main→renderer: 開き元レンダラーに window.open + document.write で子ウィンドウを開かせる */
  WINDOW_OPEN_CHILD: 'window:open-child',
  /** renderer→main: 子ウィンドウへの HTML 書き込み完了通知 */
  WINDOW_CHILD_WRITTEN: 'window:child-written',

  // ワークスペース - イベント
  WORKSPACE_CHANGED: 'workspace-changed',

  SHOW_TOAST_WINDOW: 'show-toast-window',
  EVENT_SHOW_TOAST: 'show-toast',

  // イベント（メインプロセスからレンダラーへの通知）
  EVENT_WINDOW_SHOWN: 'window-shown',
  EVENT_WINDOW_SHOWN_ITEM_SEARCH: 'window-shown-item-search',
  EVENT_WINDOW_HIDDEN: 'window-hidden',
  /** 初回設定の途中で起動ホットキーが押された（隠さずに知らせ、「試してみる」で ✓ を出す） */
  EVENT_FIRST_LAUNCH_HOTKEY_PRESSED: 'first-launch-hotkey-pressed',
  EVENT_DATA_CHANGED: 'data-changed',
  EVENT_SETTINGS_CHANGED: 'settings-changed',
  EVENT_WORKSPACE_OPEN_CHANGED: 'workspace-open-changed',
  /** ワークスペースを出し直した（高さを中身に合わせ直す。出すときに高さを作業領域いっぱいに戻すため） */
  EVENT_WORKSPACE_REFIT_HEIGHT: 'workspace-refit-height',
  EVENT_SET_ACTIVE_TAB: 'set-active-tab',
  /** 管理ウィンドウの × が押された。未保存の確認はレンダラーが行い、閉じるなら HIDE_EDIT_WINDOW を呼ぶ */
  EVENT_ADMIN_CLOSE_REQUESTED: 'admin-close-requested',
  /** 管理ウィンドウを隠した（× のほか Ctrl+E の切り替えなど、どの経路でも。開いている取込画面を閉じる。A3-187） */
  EVENT_ADMIN_HIDDEN: 'admin-hidden',
  EVENT_OPEN_IMPORT_MODAL: 'open-import-modal',
  EVENT_ICON_PROGRESS_START: 'icon-progress-start',
  EVENT_ICON_PROGRESS_UPDATE: 'icon-progress-update',
  EVENT_ICON_PROGRESS_COMPLETE: 'icon-progress-complete',
  EVENT_LAYOUT_PROGRESS_START: 'layout-progress-start',
  EVENT_LAYOUT_PROGRESS_UPDATE: 'layout-progress-update',
  EVENT_LAYOUT_PROGRESS_COMPLETE: 'layout-progress-complete',
  LAYOUT_CANCEL: 'layout-cancel',
  CLOSE_LAYOUT_PROGRESS_WINDOW: 'close-layout-progress-window',

  // コンテキストメニュー - Admin
  SHOW_ADMIN_ITEM_CONTEXT_MENU: 'show-admin-item-context-menu',
  EVENT_ADMIN_MENU_DUPLICATE_ITEMS: 'admin-menu-duplicate-items',
  EVENT_ADMIN_MENU_EDIT_ITEM: 'admin-menu-edit-item',
  EVENT_ADMIN_MENU_DELETE_ITEMS: 'admin-menu-delete-items',

  // コンテキストメニュー - Launcher
  SHOW_LAUNCHER_CONTEXT_MENU: 'show-launcher-context-menu',
  EVENT_LAUNCHER_MENU_EDIT_ITEM: 'launcher-menu-edit-item',
  EVENT_LAUNCHER_MENU_ADD_TO_WORKSPACE: 'launcher-menu-add-to-workspace',
  EVENT_LAUNCHER_MENU_ADD_COPY_TO_WORKSPACE: 'launcher-menu-add-copy-to-workspace',
  EVENT_LAUNCHER_MENU_COPY_PATH: 'launcher-menu-copy-path',
  EVENT_LAUNCHER_MENU_COPY_PARENT_PATH: 'launcher-menu-copy-parent-path',
  EVENT_LAUNCHER_MENU_OPEN_PARENT_FOLDER: 'launcher-menu-open-parent-folder',
  EVENT_LAUNCHER_MENU_RUN_AS_ADMIN: 'launcher-menu-run-as-admin',
  EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PATH: 'launcher-menu-copy-shortcut-path',
  EVENT_LAUNCHER_MENU_COPY_SHORTCUT_PARENT_PATH: 'launcher-menu-copy-shortcut-parent-path',
  EVENT_LAUNCHER_MENU_OPEN_SHORTCUT_PARENT_FOLDER: 'launcher-menu-open-shortcut-parent-folder',
  EVENT_LAUNCHER_MENU_SHOW_MEMO: 'launcher-menu-show-memo',
  /** 「削除…」（フォルダ取込で並んだアイテム・自動取込のアイテムには出さない） */
  EVENT_LAUNCHER_MENU_DELETE_ITEM: 'launcher-menu-delete-item',
  EVENT_LAUNCHER_MENU_EXCLUDE_FROM_DIR: 'launcher-menu-exclude-from-dir',
  // コンテキストメニュー - メインウィンドウの一覧の余白
  SHOW_LAUNCHER_BLANK_CONTEXT_MENU: 'show-launcher-blank-context-menu',
  EVENT_LAUNCHER_BLANK_MENU_ADD_ITEM: 'launcher-blank-menu-add-item',
  EVENT_LAUNCHER_BLANK_MENU_REGISTER_FROM_CLIPBOARD: 'launcher-blank-menu-register-from-clipboard',
  EVENT_LAUNCHER_BLANK_MENU_ADD_FOLDER_IMPORT: 'launcher-blank-menu-add-folder-import',

  // コンテキストメニュー - Workspace
  SHOW_WORKSPACE_CONTEXT_MENU: 'show-workspace-context-menu',
  EVENT_WORKSPACE_MENU_RENAME_ITEM: 'workspace-menu-rename-item',
  EVENT_WORKSPACE_MENU_EDIT_ITEM: 'workspace-menu-edit-item',
  EVENT_WORKSPACE_MENU_SHOW_MEMO: 'workspace-menu-show-memo',
  EVENT_WORKSPACE_MENU_COPY_PATH: 'workspace-menu-copy-path',
  EVENT_WORKSPACE_MENU_COPY_PARENT_PATH: 'workspace-menu-copy-parent-path',
  EVENT_WORKSPACE_MENU_OPEN_PARENT_FOLDER: 'workspace-menu-open-parent-folder',
  EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PATH: 'workspace-menu-copy-shortcut-path',
  EVENT_WORKSPACE_MENU_COPY_SHORTCUT_PARENT_PATH: 'workspace-menu-copy-shortcut-parent-path',
  EVENT_WORKSPACE_MENU_OPEN_SHORTCUT_PARENT_FOLDER: 'workspace-menu-open-shortcut-parent-folder',
  EVENT_WORKSPACE_MENU_REMOVE_ITEM: 'workspace-menu-remove-item',
  EVENT_WORKSPACE_MENU_MOVE_TO_WORKSPACE: 'workspace-menu-move-to-workspace',
  /** アイテムを別のグループへ移す（引数: アイテムの id、移す先のグループの id） */
  EVENT_WORKSPACE_MENU_MOVE_TO_GROUP: 'workspace-menu-move-to-group',

  // コンテキストメニュー - Workspace Group
  SHOW_WORKSPACE_GROUP_CONTEXT_MENU: 'show-workspace-group-context-menu',
  EVENT_WORKSPACE_GROUP_MENU_RENAME: 'workspace-group-menu-rename',
  EVENT_WORKSPACE_GROUP_MENU_SHOW_COLOR_PICKER: 'workspace-group-menu-show-color-picker',
  EVENT_WORKSPACE_GROUP_MENU_COPY_AS_TEXT: 'workspace-group-menu-copy-as-text',
  EVENT_WORKSPACE_GROUP_MENU_ARCHIVE: 'workspace-group-menu-archive',
  EVENT_WORKSPACE_GROUP_MENU_DELETE: 'workspace-group-menu-delete',
  EVENT_WORKSPACE_GROUP_MENU_ADD_SUBGROUP: 'workspace-group-menu-add-subgroup',
  EVENT_WORKSPACE_GROUP_MENU_ADD_FROM_MAIN: 'workspace-group-menu-add-from-main',
  EVENT_WORKSPACE_GROUP_MENU_ADD_NEW: 'workspace-group-menu-add-new',
  EVENT_WORKSPACE_GROUP_MENU_MOVE_TO_WORKSPACE: 'workspace-group-menu-move-to-workspace',
  EVENT_WORKSPACE_GROUP_MENU_OPEN_ALL: 'workspace-group-menu-open-all',
  EVENT_WORKSPACE_GROUP_MENU_DUPLICATE: 'workspace-group-menu-duplicate',
  EVENT_WORKSPACE_GROUP_MENU_COLLAPSE_OTHERS: 'workspace-group-menu-collapse-others',

  // コンテキストメニュー - Workspace Tab
  SHOW_WORKSPACE_TAB_CONTEXT_MENU: 'show-workspace-tab-context-menu',
  EVENT_WORKSPACE_TAB_MENU_RENAME: 'workspace-tab-menu-rename',
  EVENT_WORKSPACE_TAB_MENU_DELETE: 'workspace-tab-menu-delete',

  // コンテキストメニュー - ワークスペースの余白・「未分類」の見出し・ヘッダーの ＋（タブの右クリックとも共通の動作）
  SHOW_WORKSPACE_BLANK_CONTEXT_MENU: 'show-workspace-blank-context-menu',
  /** グループを追加（引数: 追加先のワークスペースの id） */
  EVENT_WORKSPACE_MENU_ADD_GROUP: 'workspace-menu-add-group',
  EVENT_WORKSPACE_MENU_ADD_WORKSPACE: 'workspace-menu-add-workspace',
  /** すべて展開・すべて折りたたむ（引数: ワークスペースの id、折りたたむなら true） */
  EVENT_WORKSPACE_MENU_SET_ALL_COLLAPSED: 'workspace-menu-set-all-collapsed',
  /** 「未分類」のアイテムを新しいグループにまとめる（引数: ワークスペースの id） */

  // コンテキストメニュー - File Tab
  SHOW_FILE_TAB_CONTEXT_MENU: 'show-file-tab-context-menu',
  EVENT_FILE_TAB_MENU_RENAME: 'file-tab-menu-rename',

  // コンテキストメニュー - Window
  SHOW_WINDOW_CONTEXT_MENU: 'show-window-context-menu',
  EVENT_WINDOW_MENU_ACTIVATE: 'window-menu-activate',
  EVENT_WINDOW_MENU_ADD_TO_WORKSPACE: 'window-menu-add-to-workspace',
  EVENT_WINDOW_MENU_CLOSE: 'window-menu-close',
  EVENT_WINDOW_MENU_MOVE_TO_DESKTOP: 'window-menu-move-to-desktop',
  EVENT_WINDOW_MENU_PIN: 'window-menu-pin',
  EVENT_WINDOW_MENU_UNPIN: 'window-menu-unpin',
  // コンテキストメニュー - 複数のウィンドウ（ウィンドウ検索で 2 つ以上を選んでいるとき）
  SHOW_WINDOWS_CONTEXT_MENU: 'show-windows-context-menu',
  EVENT_WINDOWS_MENU_CLOSE: 'windows-menu-close',
  EVENT_WINDOWS_MENU_PIN: 'windows-menu-pin',
  EVENT_WINDOWS_MENU_MOVE_TO_DESKTOP: 'windows-menu-move-to-desktop',
  MOVE_WINDOW_TO_DESKTOP: 'move-window-to-desktop',
  PIN_WINDOW: 'pin-window',
  UNPIN_WINDOW: 'unpin-window',
  IS_WINDOW_PINNED: 'is-window-pinned',
  CLOSE_WINDOW: 'close-window',
  WAIT_FOR_WINDOWS_CLOSED: 'wait-for-windows-closed',

  // クリップボード操作
  CLIPBOARD_CAPTURE: 'clipboard:capture',
  CLIPBOARD_RESTORE: 'clipboard:restore',
  /** 登録用にクリップボードを読む（エクスプローラーでコピーしたファイルのパスと、テキスト） */
  CLIPBOARD_READ_FOR_REGISTER: 'clipboard:read-for-register',
  CLIPBOARD_CHECK_CURRENT: 'clipboard:check-current',
  // クリップボードセッション管理（登録確定前の一時保存）
  CLIPBOARD_CAPTURE_TO_SESSION: 'clipboard:capture-to-session',
  CLIPBOARD_COMMIT_SESSION: 'clipboard:commit-session',
  CLIPBOARD_DISCARD_SESSION: 'clipboard:discard-session',
  // 実データの複製（メインウィンドウとワークスペースの間で写すとき）
  // 登録画面の内容欄（書いたテキストの保存と、見せる中身＝全文・画像の縮小版の読み出し）
  CLIPBOARD_SAVE_TEXT: 'clipboard:save-text',
  CLIPBOARD_READ_CONTENT: 'clipboard:read-content',
} as const;

/**
 * IPCチャネル名の型
 */
export type IpcChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** 進捗イベントの段階 */
export type ProgressEventType = 'start' | 'update' | 'complete';

/** アイコン取得の進捗イベントのチャネル（段階ごと） */
export const ICON_PROGRESS_CHANNELS = {
  start: IPC_CHANNELS.EVENT_ICON_PROGRESS_START,
  update: IPC_CHANNELS.EVENT_ICON_PROGRESS_UPDATE,
  complete: IPC_CHANNELS.EVENT_ICON_PROGRESS_COMPLETE,
} as const satisfies Record<ProgressEventType, IpcChannelName>;

/** レイアウト実行の進捗イベントのチャネル（段階ごと） */
export const LAYOUT_PROGRESS_CHANNELS = {
  start: IPC_CHANNELS.EVENT_LAYOUT_PROGRESS_START,
  update: IPC_CHANNELS.EVENT_LAYOUT_PROGRESS_UPDATE,
  complete: IPC_CHANNELS.EVENT_LAYOUT_PROGRESS_COMPLETE,
} as const satisfies Record<ProgressEventType, IpcChannelName>;
