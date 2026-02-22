import {
  LauncherItem,
  SimpleBookmarkItem,
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
  WindowInfo,
  VirtualDesktopInfo,
  RegisterItem,
  IconFetchErrorRecord,
  JsonDirOptions,
  ToastItemType,
  ClipboardCaptureResult,
  ClipboardRestoreResult,
  ClipboardPreview,
  CurrentClipboardState,
  DisplayInfo,
  ClipboardSessionCaptureResult,
  ClipboardSessionCommitResult,
  AppScanResult,
  WorkspacePositionMode,
  BookmarkAutoImportSettings,
  BookmarkAutoImportRule,
  BookmarkAutoImportResult,
  BookmarkFolder,
  BookmarkWithFolder,
  SnapshotInfo,
  BackupStatus,
  MixedOrderEntry,
} from '@common/types';
import type { EditableJsonItem, LoadEditableItemsResult } from '@common/types/editableItem';

export interface ElectronAPI {
  getConfigFolder: () => Promise<string>;
  getDataFiles: () => Promise<string[]>;
  createDataFile: (fileName: string) => Promise<{ success: boolean; error?: string }>;
  deleteDataFile: (
    fileName: string
  ) => Promise<{ success: boolean; error?: string; disabledRules?: string[] }>;
  loadDataFiles: () => Promise<AppItem[]>;
  openItem: (item: LauncherItem) => Promise<void>;
  openParentFolder: (item: LauncherItem) => Promise<void>;
  executeGroup: (group: GroupItem, allItems: AppItem[]) => Promise<void>;
  executeWindowOperation: (item: WindowItem) => Promise<void>;
  openConfigFolder: () => Promise<void>;
  fetchFavicon: (url: string) => Promise<string | null>;
  extractIcon: (filePath: string) => Promise<string | null>;
  extractFileIconByExtension: (filePath: string) => Promise<string | null>;
  extractCustomUriIcon: (uri: string) => Promise<string | null>;
  getIconForItem: (
    filePath: string,
    itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri' | 'clipboard'
  ) => Promise<string | null>;
  loadCachedIcons: (items: LauncherItem[]) => Promise<Record<string, string>>;
  // 統合進捗付きアイコン取得API
  fetchIconsCombined: (
    urlItems: LauncherItem[],
    items: LauncherItem[],
    forceRefresh?: boolean
  ) => Promise<{ favicons: Record<string, string | null>; icons: Record<string, string | null> }>;
  // アイコン取得エラー記録をクリア
  clearIconFetchErrors: () => Promise<{ success: boolean }>;
  // アイコン取得エラー記録を取得
  getIconFetchErrors: () => Promise<IconFetchErrorRecord[]>;
  // 進捗イベントリスナー
  onIconProgress: (
    eventType: 'start' | 'update' | 'complete',
    callback: (data: IconProgress) => void
  ) => void;
  onWindowShown: (callback: (startTime?: number) => void) => () => void;
  onWindowShownItemSearch: (callback: (startTime?: number) => void) => () => void;
  onWindowHidden: (callback: () => void) => () => void;
  onSetActiveTab: (callback: (tab: 'settings' | 'edit' | 'archive' | 'other') => void) => void;
  onOpenImportModal: (callback: (modal: 'bookmark' | 'app') => void) => () => void;
  onDataChanged: (callback: () => void) => () => void;
  onSettingsChanged: (callback: () => void) => () => void;
  onWorkspaceChanged: (callback: () => void) => () => void;
  // 3段階ピンモードAPI
  getWindowPinMode: () => Promise<WindowPinMode>;
  cycleWindowPinMode: () => Promise<WindowPinMode>;
  registerItems: (items: RegisterItem[]) => Promise<void>;
  isDirectory: (filePath: string) => Promise<boolean>;
  getPathForFile: (file: File) => string;
  quitApp: () => Promise<void>;
  getAllWindows: () => Promise<WindowInfo[]>;
  getSettings: () => Promise<AppSettings>;
  setMultipleSettings: (settings: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  validateHotkey: (hotkey: string) => Promise<{ isValid: boolean; reason?: string }>;
  changeHotkey: (newHotkey: string) => Promise<boolean>;
  changeItemSearchHotkey: (newHotkey: string) => Promise<boolean>;
  getDisplays: () => Promise<DisplayInfo[]>;
  isFirstLaunch: () => Promise<boolean>;
  updateItemById: (request: { id: string; newItem: LauncherItem }) => Promise<{ success: boolean }>;
  deleteItemsById: (requests: { id: string }[]) => Promise<{ success: boolean }>;
  batchUpdateItemsById: (
    requests: { id: string; newItem: LauncherItem }[]
  ) => Promise<{ success: boolean }>;
  // EditableJsonItem API
  loadEditableItems: () => Promise<LoadEditableItemsResult>;
  saveEditableItems: (editableItems: EditableJsonItem[]) => Promise<void>;
  // IDベースのアイテム更新
  updateDirItemById: (
    id: string,
    dirPath: string,
    options?: JsonDirOptions,
    memo?: string
  ) => Promise<void>;
  updateGroupItemById: (
    id: string,
    displayName: string,
    itemNames: string[],
    memo?: string
  ) => Promise<void>;
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
  ) => Promise<void>;
  setEditMode: (editMode: boolean) => Promise<void>;
  getEditMode: () => Promise<boolean>;
  selectBookmarkFile: () => Promise<string | null>;
  parseBookmarkFile: (filePath: string) => Promise<SimpleBookmarkItem[]>;
  // ブラウザブックマーク直接インポートAPI
  detectInstalledBrowsers: () => Promise<BrowserInfo[]>;
  parseBrowserBookmarks: (filePath: string) => Promise<SimpleBookmarkItem[]>;
  // アプリインポートAPI
  scanInstalledApps: () => Promise<AppScanResult>;
  showEditWindow: () => Promise<void>;
  hideEditWindow: () => Promise<void>;
  toggleEditWindow: () => Promise<void>;
  isEditWindowShown: () => Promise<boolean>;
  openEditWindowWithTab: (tab: 'settings' | 'edit' | 'archive' | 'other') => Promise<void>;
  openEditWindowWithImportModal: (modal: 'bookmark' | 'app') => Promise<void>;
  getInitialTab: () => Promise<'settings' | 'edit' | 'archive' | 'other'>;
  getPendingImportModal: () => Promise<'bookmark' | 'app' | null>;
  copyToClipboard: (text: string) => Promise<boolean>;
  setModalMode: (
    isModal: boolean,
    requiredSize?: { width: number; height: number }
  ) => Promise<void>;
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
  saveSearchHistory: (entries: SearchHistoryEntry[]) => Promise<void>;
  addSearchHistoryEntry: (query: string) => Promise<void>;
  clearSearchHistory: () => Promise<void>;
  // アプリ情報関連API
  getAppInfo: () => Promise<AppInfo>;
  openExternalUrl: (url: string) => Promise<void>;
  // ワークスペース関連API
  workspaceAPI: {
    loadItems: () => Promise<WorkspaceItem[]>;
    addItem: (item: AppItem, groupId?: string) => Promise<WorkspaceItem>;
    addItemsFromPaths: (filePaths: string[], groupId?: string) => Promise<WorkspaceItem[]>;
    removeItem: (id: string) => Promise<{ success: boolean }>;
    updateDisplayName: (id: string, displayName: string) => Promise<{ success: boolean }>;
    updateItem: (id: string, updates: Partial<WorkspaceItem>) => Promise<{ success: boolean }>;
    reorderItems: (itemIds: string[]) => Promise<{ success: boolean }>;
    launchItem: (item: WorkspaceItem) => Promise<{ success: boolean }>;
    // グループ管理
    loadGroups: () => Promise<WorkspaceGroup[]>;
    createGroup: (name: string, color?: string, parentGroupId?: string) => Promise<WorkspaceGroup>;
    updateGroup: (id: string, updates: Partial<WorkspaceGroup>) => Promise<{ success: boolean }>;
    deleteGroup: (id: string, deleteItems: boolean) => Promise<{ success: boolean }>;
    reorderGroups: (groupIds: string[]) => Promise<{ success: boolean }>;
    reorderMixed: (
      parentGroupId: string | undefined,
      entries: MixedOrderEntry[]
    ) => Promise<{ success: boolean }>;
    moveItemToGroup: (itemId: string, groupId?: string) => Promise<{ success: boolean }>;
    moveGroupToParent: (
      groupId: string,
      newParentGroupId?: string
    ) => Promise<{ success: boolean }>;
    setGroupsCollapsed: (ids: string[], collapsed: boolean) => Promise<{ success: boolean }>;
    // アーカイブ管理
    archiveGroup: (groupId: string) => Promise<{ success: boolean }>;
    loadArchivedGroups: () => Promise<WorkspaceGroup[]>;
    restoreGroup: (groupId: string) => Promise<{ success: boolean }>;
    deleteArchivedGroup: (groupId: string) => Promise<{ success: boolean }>;
    // ピン留め関連
    getAlwaysOnTop: () => Promise<boolean>;
    toggleAlwaysOnTop: () => Promise<boolean>;
    // モーダルモード関連
    setModalMode: (isModal: boolean, requiredSize?: { width: number; height: number }) => void;
    // 透過度関連
    setOpacity: (opacityPercent: number) => Promise<boolean>;
    getOpacity: () => Promise<number>;
    // サイズ変更関連
    setSize: (width: number, height: number) => Promise<boolean>;
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
    hideAllDetached: () => Promise<{ success: boolean }>;
    showAllDetached: () => Promise<{ success: boolean }>;
    resizeCallerWindow: (width: number, height: number) => Promise<boolean>;
    setCallerBounds: (x: number, y: number, width: number, height: number) => Promise<boolean>;
    // 切り離しウィンドウ状態永続化
    loadDetachedState: (rootGroupId: string) => Promise<{
      collapsedStates: Record<string, boolean>;
      bounds: { x: number; y: number; width: number; height: number };
    } | null>;
    saveDetachedCollapsed: (
      rootGroupId: string,
      states: Record<string, boolean>
    ) => Promise<{ success: boolean }>;
    saveDetachedBounds: (
      rootGroupId: string,
      bounds: { x: number; y: number; width: number; height: number }
    ) => Promise<{ success: boolean }>;
  };
  // ウィンドウ検索API
  getWindowList: () => Promise<WindowInfo[]>;
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
  closeWindow: (hwnd: number | bigint) => Promise<{ success: boolean; error?: string }>;
  // システム通知API
  showNotification: (
    title: string,
    body: string,
    type?: 'success' | 'error' | 'info' | 'warning'
  ) => Promise<void>;
  // トーストウィンドウAPI（メインウィンドウが閉じた後も表示可能）
  showToastWindow: (options: {
    message?: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
    itemType?: ToastItemType;
    displayName?: string;
    path?: string;
    icon?: string;
    itemCount?: number;
    itemNames?: string[];
  }) => Promise<void>;
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
  ) => void;
  // ワークスペースウィンドウ制御API
  toggleWorkspaceWindow: () => Promise<void>;
  showWorkspaceWindow: () => Promise<void>;
  hideWorkspaceWindow: () => Promise<void>;
  // コンテキストメニュー表示API
  showAdminItemContextMenu: (selectedCount: number, isSingleLine: boolean) => Promise<void>;
  showLauncherContextMenu: (item: AppItem) => Promise<void>;
  showWorkspaceContextMenu: (item: WorkspaceItem, groups: WorkspaceGroup[]) => Promise<void>;
  showWorkspaceGroupContextMenu: (group: WorkspaceGroup, canAddSubgroup: boolean) => Promise<void>;
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
  onMoveWindowToDesktop: (
    callback: (hwnd: number | bigint, desktopNumber: number) => void
  ) => () => void;
  onPinWindow: (callback: (hwnd: number | bigint) => void) => () => void;
  onUnPinWindow: (callback: (hwnd: number | bigint) => void) => () => void;
  // WorkspaceContextMenuイベントリスナー
  onWorkspaceMenuRenameItem: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuEditItem: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuLaunchItem: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuCopyPath: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuCopyParentPath: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuOpenParentFolder: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuCopyShortcutPath: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuCopyShortcutParentPath: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuOpenShortcutParentFolder: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuRemoveFromGroup: (callback: (itemId: string) => void) => () => void;
  onWorkspaceMenuRemoveItem: (callback: (itemId: string) => void) => () => void;
  // WorkspaceGroupContextMenuイベントリスナー
  onWorkspaceGroupMenuRename: (callback: (groupId: string) => void) => () => void;
  onWorkspaceGroupMenuShowColorPicker: (callback: (groupId: string) => void) => () => void;
  onWorkspaceGroupMenuChangeColor: (
    callback: (groupId: string, color: string) => void
  ) => () => void;
  onWorkspaceGroupMenuCopyAsText: (callback: (groupId: string) => void) => () => void;
  onWorkspaceGroupMenuArchive: (callback: (groupId: string) => void) => () => void;
  onWorkspaceGroupMenuDelete: (callback: (groupId: string) => void) => () => void;
  onWorkspaceGroupMenuAddSubgroup: (callback: (groupId: string) => void) => () => void;
  onWorkspaceGroupMenuChangeIcon: (callback: (groupId: string) => void) => () => void;
  // ブックマーク自動取込API
  bookmarkAutoImportAPI: {
    getSettings: () => Promise<BookmarkAutoImportSettings>;
    saveSettings: (settings: BookmarkAutoImportSettings) => Promise<void>;
    executeRule: (rule: BookmarkAutoImportRule) => Promise<BookmarkAutoImportResult>;
    executeAll: () => Promise<BookmarkAutoImportResult[]>;
    previewRule: (rule: BookmarkAutoImportRule) => Promise<BookmarkWithFolder[]>;
    getFolders: (bookmarkPath: string) => Promise<BookmarkFolder[]>;
    getBookmarksWithFolders: (bookmarkPath: string) => Promise<BookmarkWithFolder[]>;
    deleteRuleItems: (ruleId: string, targetFile: string) => Promise<number>;
  };
  // クリップボード関連API
  clipboardAPI: {
    checkCurrent: () => Promise<CurrentClipboardState>;
    capture: () => Promise<ClipboardCaptureResult>;
    restore: (dataFileRef: string) => Promise<ClipboardRestoreResult>;
    deleteData: (dataFileRef: string) => Promise<boolean>;
    getPreview: (dataFileRef: string) => Promise<ClipboardPreview | null>;
    // セッション管理（登録確定前の一時保存）
    captureToSession: () => Promise<ClipboardSessionCaptureResult>;
    commitSession: (sessionId: string) => Promise<ClipboardSessionCommitResult>;
    discardSession: (sessionId: string) => Promise<boolean>;
  };
  // バックアップAPI
  backupAPI: {
    listSnapshots: () => Promise<SnapshotInfo[]>;
    restoreSnapshot: (timestamp: string) => Promise<{ success: boolean; error?: string }>;
    deleteSnapshot: (timestamp: string) => Promise<{ success: boolean; error?: string }>;
    getStatus: () => Promise<BackupStatus>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
