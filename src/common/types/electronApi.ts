/**
 * preload（contextBridge）がレンダラーへ公開する API の型。
 * preload 側はこの型で注釈しているため、実装とのずれは型チェックで検出される。
 */
import type { PathKind } from '../utils/itemTypeDetector';
import type { DefaultBrowser } from '../itemConversions';
import type { AppLanguage } from '../i18n/languages';
import type { ProgressEventType } from '../ipcChannels';
import type { ScreenArea } from '../utils/placementLabel';

import type { SetItemFields } from './launcher';
import type {
  EditableJsonItem,
  LoadEditableItemsResult,
  PathExistenceStatus,
  SaveEditableItemsResult,
} from './editableItem';

import type {
  LauncherItem,
  AppSettings,
  IconProgress,
  LayoutExecutionProgress,
  PinLevel,
  SearchHistoryEntry,
  SetItem,
  AppItem,
  AppInfo,
  BrowserInfo,
  Workspace,
  WorkspaceItem,
  WorkspaceItemUpdate,
  WorkspaceGroup,
  WorkspaceGroupUpdate,
  WorkspaceGroupView,
  DetachedWindowState,
  ArchivedWorkspaceGroup,
  ArchivedWorkspaceItem,
  WindowInfo,
  VirtualDesktopInfo,
  RegisterItem,
  ItemPathPickKind,
  DirPreviewResult,
  IconFetchErrorRecord,
  JsonDirOptions,
  ToastOptions,
  ToastEventData,
  ClipboardCaptureResult,
  ClipboardRestoreResult,
  CurrentClipboardState,
  DisplayInfo,
  AutoLaunchStatus,
  ClipboardSessionCaptureResult,
  ClipboardSessionCommitResult,
  ClipboardContent,
  ClipboardContentSource,
  AppScanResult,
  WorkspacePositionMode,
  BookmarkAutoImportSettings,
  BookmarkAutoImportRule,
  BookmarkAutoImportResult,
  BookmarkWithFolder,
  SnapshotInfo,
  BackupStatus,
  MixedOrderEntry,
  MainChildWindowRequest,
  MainChildWindowResult,
  MainChildWindowReturn,
  ConfirmWindowRequest,
  ConfirmWindowResult,
  AdminTab,
} from './index';

export interface ElectronAPI {
  getConfigFolder: () => Promise<string>;
  getDataFiles: () => Promise<string[]>;
  /** 既にあるときは success: false・alreadyExists: true（作成済みかどうかの確認にも使う） */
  createDataFile: (
    fileName: string
  ) => Promise<{ success: boolean; error?: string; alreadyExists?: boolean }>;
  deleteDataFile: (
    fileName: string
  ) => Promise<{ success: boolean; error?: string; disabledRules?: string[] }>;
  /**
   * trigger 省略 = 起動時・F5（レポートを必ず書く）。'full' = 完全リフレッシュ（レポートを書き、パスの種類も確かめ直す）。
   * 'internal' = 変更通知・画面内の一覧取得
   */
  loadDataFiles: (trigger?: 'explicit' | 'full' | 'internal') => Promise<AppItem[]>;
  openItem: (item: LauncherItem) => Promise<void>;
  openParentFolder: (item: LauncherItem) => Promise<void>;
  /** セットを実行する。行の itemId は allItems（全タブのアイテム）から探す */
  executeSet: (item: SetItem, allItems: AppItem[]) => Promise<void>;
  openConfigFolder: () => Promise<void>;
  fetchFavicon: (url: string) => Promise<string | null>;
  extractIcon: (filePath: string) => Promise<string | null>;
  getIconForItem: (
    filePath: string,
    itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'windowSwitch' | 'clipboard'
  ) => Promise<string | null>;
  loadCachedIcons: (items: LauncherItem[]) => Promise<Record<string, string>>;
  // 統合進捗付きアイコン取得API
  fetchIconsCombined: (
    urlItems: LauncherItem[],
    items: LauncherItem[],
    forceRefresh?: boolean,
    /** true なら進捗バーを出さずに取る（初回設定の後の自動取得） */
    silent?: boolean
  ) => Promise<{ favicons: Record<string, string | null>; icons: Record<string, string | null> }>;
  // キャッシュ欠損の補完API（進捗通知なし）
  ensureIcons: (items: LauncherItem[]) => Promise<Record<string, string>>;
  // アイコン取得エラー記録を取得
  getIconFetchErrors: () => Promise<IconFetchErrorRecord[]>;
  // 進捗イベントリスナー
  onIconProgress: (
    eventType: ProgressEventType,
    callback: (data: IconProgress) => void
  ) => () => void;
  onLayoutProgress: (
    eventType: ProgressEventType,
    callback: (data: LayoutExecutionProgress) => void
  ) => () => void;
  cancelLayout: () => void;
  closeLayoutProgressWindow: () => void;
  onWindowShown: (callback: (startTime?: number) => void) => () => void;
  onWindowShownItemSearch: (callback: (startTime?: number) => void) => () => void;
  onWindowHidden: (callback: () => void) => () => void;
  /** 初回設定の途中で起動ホットキーが押された */
  onFirstLaunchHotkeyPressed: (callback: () => void) => () => void;
  onSetActiveTab: (callback: (tab: AdminTab) => void) => () => void;
  /** 管理ウィンドウの × が押されたとき。閉じてよければ hideEditWindow を呼ぶ */
  onAdminCloseRequested: (callback: () => void) => () => void;
  onOpenImportModal: (callback: (modal: 'bookmark' | 'app') => void) => () => void;
  onDataChanged: (callback: () => void) => () => void;
  onSettingsChanged: (callback: () => void) => () => void;
  /** ワークスペースが開いているか（⭐ ボタンの押し込み表示） */
  isWorkspaceOpen: () => Promise<boolean>;
  /** ワークスペースを開いた・閉じたとき */
  onWorkspaceOpenChanged: (callback: (open: boolean) => void) => () => void;
  /** ワークスペースを出し直したとき（高さを中身に合わせ直す） */
  onWorkspaceRefitHeight: (callback: () => void) => () => void;
  onWorkspaceChanged: (callback: () => void) => () => void;
  /** ピン留め。呼んだウィンドウ（メイン・ワークスペース・切り離し）が対象 */
  pin: {
    get: () => Promise<PinLevel>;
    /** 段階を変え、変えた後の段階を返す */
    set: (level: PinLevel) => Promise<PinLevel>;
    /** 📌 の右クリックメニュー（表示固定・常に最前面）を出し、閉じた後の段階を返す */
    showMenu: () => Promise<PinLevel>;
    /** メインプロセス側で段階が変わったとき（このウィンドウの分だけ届く） */
    onChanged: (callback: (level: PinLevel) => void) => () => void;
  };
  /** true のあいだ、メインウィンドウの Esc を隠す処理に回さずページで受ける（複数選択の解除・確認の取り消し） */
  setEscapeHandledByPage: (handled: boolean) => void;
  /** 呼び出したウィンドウの移動を始める（マウスのボタンを押している間に呼ぶ。切り離しウィンドウの見出しを掴んだとき） */
  startWindowMove: () => void;
  registerItems: (items: RegisterItem[]) => Promise<void>;
  /** パスがフォルダ・ファイル・存在しないのどれかを確かめる（登録画面へのドロップ） */
  getPathKind: (filePath: string) => Promise<PathKind>;
  /** ファイルかフォルダを選ぶダイアログを開き、選んだパスを返す（やめたら null。登録・編集画面のパス欄の「選択」） */
  selectItemPath: (kind: ItemPathPickKind, currentPath?: string) => Promise<string | null>;
  /** フォルダ取込で何が並ぶかを走査する（登録・編集画面のプレビュー。同じ画面の前の走査はやめる） */
  previewDirItems: (dirPath: string, options: JsonDirOptions) => Promise<DirPreviewResult>;
  /** 走査中のプレビューをやめる（結果は status: cancelled で返る） */
  cancelDirPreview: () => Promise<void>;
  /** 既定のブラウザの exe と表示名（取れなければ null。登録・編集画面の「変換」） */
  getDefaultBrowser: () => Promise<DefaultBrowser | null>;
  /** 拡張子（例 .md）に関連付けられたプログラムの exe と表示名（取れなければ null。登録・編集画面の「変換」） */
  getFileHandler: (extension: string) => Promise<DefaultBrowser | null>;
  /**
   * パスが実在するかをまとめて確認する（押したときだけ呼ぶ）。環境変数（%VAR%）は展開して調べ、
   * 応答しないパスは時間切れで unknown にする
   */
  checkPathsExist: (paths: string[]) => Promise<Record<string, PathExistenceStatus>>;
  /**
   * アイテム管理の CSV を、保存先を選んでもらって書く（BOM 付きの UTF-8）。
   * 書いたファイルのパスを返す。選ぶのをやめたら null
   */
  exportItemsCsv: (text: string, defaultName: string) => Promise<string | null>;
  /** アイテム管理に取り込む CSV を選んでもらって読む。選ぶのをやめたら null */
  readItemsCsv: () => Promise<{ filePath: string; text: string } | null>;
  getPathForFile: (file: File) => string;
  quitApp: () => Promise<void>;
  getAllWindows: () => Promise<WindowInfo[]>;
  getSettings: () => Promise<AppSettings>;
  setMultipleSettings: (settings: Partial<AppSettings>) => Promise<void>;
  /**
   * 設定を既定値に戻す。keys を渡すとその項目だけ、省略すると全項目。
   * 副作用（自動起動・ウィンドウ状態・ホットキー）も適用し直し、戻した後の設定を返す
   */
  resetSettings: (keys?: Array<keyof AppSettings>) => Promise<AppSettings>;
  /** settings.json をディスクから読み直して副作用（ホットキー等）を適用し直す（F5） */
  reapplySettings: () => Promise<void>;
  validateHotkey: (hotkey: string) => Promise<{ isValid: boolean; reason?: string }>;
  changeHotkey: (newHotkey: string) => Promise<boolean>;
  changeItemSearchHotkey: (newHotkey: string) => Promise<boolean>;
  /** ホットキー入力欄の録画の開始・終了を伝える（録画中は QDL のホットキーとウィンドウメニューを止める） */
  setHotkeyRecording: (recording: boolean) => Promise<void>;
  getDisplays: () => Promise<DisplayInfo[]>;
  /** 画面ごとの全体と作業領域（物理ピクセル。ウィンドウの座標と同じ単位。セットの位置の表示に使う） */
  getScreenAreas: () => Promise<ScreenArea[]>;
  /** OS 側の自動起動の状態（Store 版では Windows の StartupTask の状態） */
  getAutoLaunchStatus: () => Promise<AutoLaunchStatus>;
  /** 今の表示言語（設定と Windows の表示言語から決めたもの） */
  getLanguage: () => Promise<AppLanguage>;
  isFirstLaunch: () => Promise<boolean>;
  updateItemById: (request: { id: string; newItem: LauncherItem }) => Promise<{ success: boolean }>;
  deleteItemsById: (requests: { id: string }[]) => Promise<{ success: boolean }>;
  // EditableJsonItem API
  loadEditableItems: () => Promise<LoadEditableItemsResult>;
  /**
   * expectedHashes（loadEditableItems の fileHashes）を渡すと外部変更との競合時に保存を拒否する。
   * 内容が変わったファイルだけ書き、保存後のハッシュを返す
   */
  saveEditableItems: (
    editableItems: EditableJsonItem[],
    expectedHashes?: Record<string, string>
  ) => Promise<SaveEditableItemsResult>;
  // IDベースのアイテム更新
  updateDirItemById: (
    id: string,
    dirPath: string,
    options?: JsonDirOptions,
    memo?: string
  ) => Promise<void>;
  updateSetItemById: (id: string, set: SetItemFields, memo?: string) => Promise<void>;
  selectBookmarkFile: () => Promise<string | null>;
  /** HTML ブックマークファイル（Netscape 形式）をフォルダ付きで読む（取込画面用） */
  parseBookmarkFileWithFolders: (filePath: string) => Promise<BookmarkWithFolder[]>;
  // ブラウザブックマーク直接インポートAPI
  detectInstalledBrowsers: () => Promise<BrowserInfo[]>;
  // アプリインポートAPI
  scanInstalledApps: () => Promise<AppScanResult>;
  hideEditWindow: () => Promise<void>;
  toggleEditWindow: () => Promise<void>;
  openEditWindowWithTab: (tab: AdminTab) => Promise<void>;
  openEditWindowWithImportModal: (modal: 'bookmark' | 'app') => Promise<void>;
  getInitialTab: () => Promise<AdminTab>;
  getPendingImportModal: () => Promise<'bookmark' | 'app' | null>;
  copyToClipboard: (text: string) => Promise<boolean>;
  /**
   * メイン画面の子ウィンドウ（アイテムの登録・編集、アイコン取得結果）を開く
   * 開き元（メイン画面・管理画面）は動かさない。子ウィンドウが閉じたら、子が返した内容
   * （returnToOpener のとき。なければ null）で解決する
   */
  openMainChildWindow: (request: MainChildWindowRequest) => Promise<MainChildWindowReturn | null>;
  /** 子ウィンドウが自分の requestId で要求（表示内容）を受け取る */
  getMainChildWindowRequest: (requestId: string) => Promise<MainChildWindowRequest | null>;
  /** 子ウィンドウでの操作結果をメイン画面へ知らせる（トースト表示用） */
  notifyMainChildWindowResult: (result: MainChildWindowResult) => void;
  /** 子ウィンドウが開き元へ返す内容を預ける（returnToOpener のとき。この後 window.close する） */
  returnMainChildWindowValue: (requestId: string, value: MainChildWindowReturn) => Promise<void>;
  onMainChildWindowResult: (callback: (result: MainChildWindowResult) => void) => () => void;
  // パフォーマンス計測API
  logPerformanceTiming: (label: string, duration: number) => Promise<void>;
  // カスタムアイコン関連API
  selectCustomIconFile: () => Promise<string | null>;
  saveCustomIcon: (sourceFilePath: string, itemIdentifier: string) => Promise<string>;
  deleteCustomIcon: (customIconFileName: string) => Promise<void>;
  getCustomIcon: (customIconFileName: string) => Promise<string | null>;
  // スプラッシュスクリーン関連API
  splashReady: () => Promise<boolean>;
  onSplashInitComplete: (callback: () => void) => () => void;
  notifyRendererReady: () => Promise<void>;
  // 検索履歴関連API
  loadSearchHistory: () => Promise<SearchHistoryEntry[]>;
  addSearchHistoryEntry: (query: string) => Promise<void>;
  clearSearchHistory: () => Promise<void>;
  // アプリ情報関連API
  getAppInfo: () => Promise<AppInfo>;
  /** http・https の URL を既定のブラウザで開く（それ以外のスキームは開かない） */
  openExternalUrl: (url: string) => Promise<void>;
  /** 存在するフォルダをエクスプローラーで開く（フォルダ以外は開かない） */
  openFolder: (folderPath: string) => Promise<void>;
  // ワークスペース関連API
  workspaceAPI: {
    // ワークスペース（タブ）管理
    loadWorkspaces: () => Promise<Workspace[]>;
    createWorkspace: (name: string) => Promise<Workspace>;
    renameWorkspace: (id: string, name: string) => Promise<{ success: boolean }>;
    deleteWorkspace: (id: string) => Promise<{ success: boolean }>;
    reorderWorkspaces: (ids: string[]) => Promise<{ success: boolean }>;
    // アイテム管理
    loadItems: () => Promise<WorkspaceItem[]>;
    addItem: (item: AppItem, groupId?: string, workspaceId?: string) => Promise<WorkspaceItem>;
    addItemsFromPaths: (
      filePaths: string[],
      groupId?: string,
      workspaceId?: string
    ) => Promise<WorkspaceItem[]>;
    removeItem: (id: string) => Promise<{ success: boolean }>;
    updateDisplayName: (id: string, displayName: string) => Promise<{ success: boolean }>;
    updateItem: (id: string, updates: WorkspaceItemUpdate) => Promise<{ success: boolean }>;
    launchItem: (item: WorkspaceItem) => Promise<{ success: boolean }>;
    // グループ管理
    loadGroups: () => Promise<WorkspaceGroupView[]>;
    createGroup: (
      name: string,
      color?: string,
      parentGroupId?: string,
      workspaceId?: string
    ) => Promise<WorkspaceGroupView>;
    updateGroup: (id: string, updates: WorkspaceGroupUpdate) => Promise<{ success: boolean }>;
    deleteGroup: (id: string, deleteItems: boolean) => Promise<{ success: boolean }>;
    reorderMixed: (
      parentGroupId: string | undefined,
      entries: MixedOrderEntry[]
    ) => Promise<{ success: boolean }>;
    duplicateItem: (
      sourceItemId: string,
      targetGroupId?: string,
      insertOrder?: number
    ) => Promise<{ success: boolean }>;
    moveItemToGroup: (itemId: string, groupId?: string) => Promise<{ success: boolean }>;
    moveGroupToParent: (
      groupId: string,
      newParentGroupId?: string
    ) => Promise<{ success: boolean }>;
    moveItemToWorkspace: (
      itemId: string,
      targetWorkspaceId: string
    ) => Promise<{ success: boolean }>;
    moveGroupToWorkspace: (
      groupId: string,
      targetWorkspaceId: string
    ) => Promise<{ success: boolean }>;
    setGroupsCollapsed: (ids: string[], collapsed: boolean) => Promise<{ success: boolean }>;
    // アーカイブ管理
    archiveGroup: (groupId: string) => Promise<{ success: boolean }>;
    loadArchivedGroups: () => Promise<ArchivedWorkspaceGroup[]>;
    loadArchivedItems: () => Promise<ArchivedWorkspaceItem[]>;
    deleteArchivedGroup: (groupId: string) => Promise<{ success: boolean }>;
    // ピン留め関連
    getAlwaysOnTop: () => Promise<boolean>;
    toggleAlwaysOnTop: () => Promise<boolean>;
    /** アイテムの編集を独立した子ウィンドウで開く（開き元のウィンドウは動かさない） */
    openItemEditor: (itemId: string) => Promise<void>;
    /**
     * 確認を独立した子ウィンドウで開く（開き元のウィンドウは動かさない）
     * 確認されたら結果、キャンセル・閉じたときは null で解決する
     */
    openConfirm: (request: ConfirmWindowRequest) => Promise<ConfirmWindowResult | null>;
    /** 確認ウィンドウが自分の requestId で要求（表示内容）を受け取る */
    getConfirmRequest: (requestId: string) => Promise<ConfirmWindowRequest | null>;
    /** 確認ウィンドウが結果を預ける（この後 window.close する） */
    returnConfirmResult: (requestId: string, result: ConfirmWindowResult) => Promise<void>;
    // サイズ変更関連
    /** 高さだけを変える（幅はメインプロセスの今の値のまま） */
    setHeight: (height: number) => Promise<boolean>;
    setPositionAndSize: (x: number, y: number, width: number, height: number) => Promise<boolean>;
    // 位置モード設定
    setPositionMode: (mode: WorkspacePositionMode) => Promise<boolean>;
    // ウィンドウ制御
    hideWindow: () => Promise<boolean>;
    // 切り離しウィンドウ
    detachGroup: (
      groupId: string,
      cursorX?: number,
      cursorY?: number
    ) => Promise<{ success: boolean }>;
    closeDetachedGroup: (groupId: string) => Promise<{ success: boolean }>;
    resizeCallerWindow: (width: number, height: number) => Promise<boolean>;
    setCallerBounds: (x: number, y: number, width: number, height: number) => Promise<boolean>;
    // 切り離しウィンドウ状態永続化
    loadDetachedState: (rootGroupId: string) => Promise<DetachedWindowState | null>;
    saveDetachedCollapsed: (
      rootGroupId: string,
      states: Record<string, boolean>
    ) => Promise<{ success: boolean }>;
  };
  // ウィンドウ検索API
  getAllWindowsAllDesktops: () => Promise<WindowInfo[]>;
  getVirtualDesktopInfo: () => Promise<VirtualDesktopInfo>;
  activateWindowByHwnd: (hwnd: number | bigint) => Promise<{ success: boolean; error?: string }>;
  moveWindowToDesktop: (
    hwnd: number | bigint,
    desktopNumber: number
  ) => Promise<{ success: boolean; error?: string }>;
  pinWindow: (hwnd: number | bigint) => Promise<{ success: boolean; error?: string }>;
  unPinWindow: (hwnd: number | bigint) => Promise<{ success: boolean; error?: string }>;
  isWindowPinned: (hwnd: number | bigint) => Promise<boolean>;
  /** WM_CLOSE を送るだけで、相手の処理は待たない。閉じたかは waitForWindowsClosed の後に一覧を取り直して見る */
  closeWindow: (hwnd: number | bigint) => Promise<{ success: boolean; error?: string }>;
  /** ウィンドウが閉じる（か隠れる）のを、まとめて最大 1 秒待つ */
  waitForWindowsClosed: (hwnds: (number | bigint)[]) => Promise<void>;
  // トーストウィンドウAPI（メインウィンドウが閉じた後も表示可能）
  showToastWindow: (options: ToastOptions) => Promise<void>;
  // トーストウィンドウ用イベントリスナー（toast.html用）
  onShowToast: (callback: (data: ToastEventData) => void) => () => void;
  // ワークスペースウィンドウ制御API
  toggleWorkspaceWindow: () => Promise<void>;
  // コンテキストメニュー表示API
  showAdminItemContextMenu: (selectedCount: number, isSingleLine: boolean) => Promise<void>;
  showLauncherContextMenu: (item: AppItem) => Promise<void>;
  showWorkspaceContextMenu: (
    item: WorkspaceItem,
    groups: WorkspaceGroup[],
    workspaces?: Workspace[]
  ) => Promise<void>;
  showWorkspaceGroupContextMenu: (
    group: WorkspaceGroup,
    canAddSubgroup: boolean,
    workspaces?: Workspace[],
    isArchived?: boolean
  ) => Promise<void>;
  // WorkspaceTabContextMenu
  showWorkspaceTabContextMenu: (workspaceId: string, canDelete: boolean) => Promise<void>;
  onWorkspaceTabMenuRename: (callback: (workspaceId: string) => void) => () => void;
  onWorkspaceTabMenuDelete: (callback: (workspaceId: string) => void) => () => void;
  // FileTabContextMenu
  showFileTabContextMenu: (tabIndex: number) => Promise<void>;
  onFileTabMenuRename: (callback: (tabIndex: number) => void) => () => void;
  showWindowContextMenu: (
    windowInfo: WindowInfo,
    desktopInfo: VirtualDesktopInfo,
    isPinned: boolean
  ) => Promise<void>;
  // AdminItemManagerContextMenuイベントリスナー
  onAdminMenuDuplicateItems: (callback: () => void) => () => void;
  onAdminMenuEditItem: (callback: () => void) => () => void;
  onAdminMenuDeleteItems: (callback: () => void) => () => void;
  // LauncherContextMenuイベントリスナー
  onLauncherMenuEditItem: (callback: (item: AppItem) => void) => () => void;
  onLauncherMenuAddToWorkspace: (callback: (item: AppItem) => void) => () => void;
  onLauncherMenuCopyPath: (callback: (item: AppItem) => void) => () => void;
  onLauncherMenuCopyParentPath: (callback: (item: AppItem) => void) => () => void;
  onLauncherMenuOpenParentFolder: (callback: (item: AppItem) => void) => () => void;
  onLauncherMenuCopyShortcutPath: (callback: (item: AppItem) => void) => () => void;
  onLauncherMenuCopyShortcutParentPath: (callback: (item: AppItem) => void) => () => void;
  onLauncherMenuOpenShortcutParentFolder: (callback: (item: AppItem) => void) => () => void;
  onLauncherMenuShowMemo: (callback: (item: AppItem) => void) => () => void;
  // WindowContextMenuイベントリスナー
  onWindowMenuActivate: (callback: (windowInfo: WindowInfo) => void) => () => void;
  /** ウィンドウ検索結果の右クリック「ワークスペースに追加」（includePosition: 今の位置・サイズも記録） */
  onWindowMenuAddToWorkspace: (
    callback: (payload: { windowInfo: WindowInfo; includePosition: boolean }) => void
  ) => () => void;
  /** ウィンドウ検索で 2 つ以上を選んでいるときの右クリックメニュー */
  showWindowsContextMenu: (count: number, desktopInfo: VirtualDesktopInfo) => Promise<void>;
  onWindowsMenuClose: (callback: () => void) => () => void;
  /** pin: true で固定、false で固定解除 */
  onWindowsMenuPin: (callback: (pin: boolean) => void) => () => void;
  onWindowsMenuMoveToDesktop: (callback: (desktopNumber: number) => void) => () => void;
  /** ウィンドウ検索結果の右クリック「ウィンドウを閉じる」（Ctrl+D と同じ） */
  onWindowMenuClose: (callback: (windowInfo: WindowInfo) => void) => () => void;
  onMoveWindowToDesktop: (
    callback: (hwnd: number | bigint, desktopNumber: number) => void
  ) => () => void;
  onPinWindow: (callback: (hwnd: number | bigint) => void) => () => void;
  onUnPinWindow: (callback: (hwnd: number | bigint) => void) => () => void;
  // WorkspaceContextMenuイベントリスナー
  onWorkspaceMenuRenameItem: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuEditItem: (callback: (itemId: string) => void) => () => void;
  /** ワークスペースの「メインウィンドウに登録」（メインウィンドウで受ける） */
  onRegisterWorkspaceItemToMain: (callback: (item: WorkspaceItem) => void) => () => void;
  onWorkspaceMenuShowMemo: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuCopyPath: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuCopyParentPath: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuOpenParentFolder: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuCopyShortcutPath: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuCopyShortcutParentPath: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuOpenShortcutParentFolder: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuRemoveFromGroup: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuRemoveItem: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuMoveToWorkspace: (
    callback: (itemId: string, targetWorkspaceId: string) => void
  ) => () => void;
  // WorkspaceGroupContextMenuイベントリスナー
  onWorkspaceGroupMenuRename: (callback: (groupId: string) => void) => () => void;
  onWorkspaceGroupMenuShowColorPicker: (callback: (groupId: string) => void) => () => void;
  onWorkspaceGroupMenuCopyAsText: (callback: (groupId: string) => void) => () => void;
  onWorkspaceGroupMenuArchive: (callback: (groupId: string) => void) => () => void;
  onWorkspaceGroupMenuDelete: (callback: (groupId: string) => void) => () => void;
  onWorkspaceGroupMenuAddSubgroup: (callback: (groupId: string) => void) => () => void;
  onWorkspaceGroupMenuMoveToWorkspace: (
    callback: (groupId: string, targetWorkspaceId: string) => void
  ) => () => void;
  // ブックマーク自動取込API
  bookmarkAutoImportAPI: {
    getSettings: () => Promise<BookmarkAutoImportSettings>;
    saveSettings: (settings: BookmarkAutoImportSettings) => Promise<void>;
    executeRule: (rule: BookmarkAutoImportRule) => Promise<BookmarkAutoImportResult>;
    executeAll: () => Promise<BookmarkAutoImportResult[]>;
    getBookmarksWithFolders: (bookmarkPath: string) => Promise<BookmarkWithFolder[]>;
    deleteRuleItems: (ruleId: string, targetFile: string) => Promise<number>;
  };
  // クリップボード関連API
  clipboardAPI: {
    checkCurrent: () => Promise<CurrentClipboardState>;
    capture: () => Promise<ClipboardCaptureResult>;
    restore: (dataFileRef: string) => Promise<ClipboardRestoreResult>;
    // セッション管理（登録確定前の一時保存）
    captureToSession: () => Promise<ClipboardSessionCaptureResult>;
    commitSession: (sessionId: string) => Promise<ClipboardSessionCommitResult>;
    discardSession: (sessionId: string) => Promise<boolean>;
    /** 実データのファイルを複製し、新しい参照を返す（読めなければ null） */
    duplicateData: (dataFileRef: string) => Promise<string | null>;
    /** 登録画面で書いたテキストを、テキストだけの実データとして保存する */
    saveText: (text: string) => Promise<ClipboardCaptureResult>;
    /** 未確定のキャプチャか保存済みの実データから、テキストの全文と画像の縮小版を読む（読めなければ null） */
    readContent: (source: ClipboardContentSource) => Promise<ClipboardContent | null>;
  };
  // バックアップAPI
  backupAPI: {
    listSnapshots: () => Promise<SnapshotInfo[]>;
    restoreSnapshot: (timestamp: string) => Promise<{ success: boolean; error?: string }>;
    deleteSnapshot: (timestamp: string) => Promise<{ success: boolean; error?: string }>;
    getStatus: () => Promise<BackupStatus>;
  };
}
