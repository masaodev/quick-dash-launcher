import {
  LauncherItem,
  RawDataLine,
  SimpleBookmarkItem,
  AppSettings,
  IconProgress,
  WindowPinMode,
  SearchHistoryEntry,
  GroupItem,
  AppItem,
  AppInfo,
  BrowserInfo,
  WorkspaceItem,
  WorkspaceGroup,
  ExecutionHistoryItem,
} from '../common/types';

import { RegisterItem } from './components/RegisterModal';

export interface ElectronAPI {
  getConfigFolder: () => Promise<string>;
  getDataFiles: () => Promise<string[]>;
  createDataFile: (fileName: string) => Promise<{ success: boolean; error?: string }>;
  deleteDataFile: (fileName: string) => Promise<{ success: boolean; error?: string }>;
  loadDataFiles: () => Promise<AppItem[]>;
  openItem: (item: LauncherItem) => Promise<void>;
  openParentFolder: (item: LauncherItem) => Promise<void>;
  executeGroup: (group: GroupItem, allItems: AppItem[]) => Promise<void>;
  openConfigFolder: () => Promise<void>;
  fetchFavicon: (url: string) => Promise<string | null>;
  extractIcon: (filePath: string) => Promise<string | null>;
  extractFileIconByExtension: (filePath: string) => Promise<string | null>;
  extractCustomUriIcon: (uri: string) => Promise<string | null>;
  getIconForItem: (
    filePath: string,
    itemType: 'url' | 'file' | 'folder' | 'app' | 'customUri'
  ) => Promise<string | null>;
  loadCachedIcons: (items: LauncherItem[]) => Promise<Record<string, string>>;
  // 統合進捗付きアイコン取得API
  fetchIconsCombined: (
    urlItems: LauncherItem[],
    items: LauncherItem[]
  ) => Promise<{ favicons: Record<string, string | null>; icons: Record<string, string | null> }>;
  // 進捗イベントリスナー
  onIconProgress: (
    eventType: 'start' | 'update' | 'complete',
    callback: (data: IconProgress) => void
  ) => void;
  onWindowShown: (callback: (startTime?: number) => void) => () => void;
  onWindowHidden: (callback: () => void) => () => void;
  onSetActiveTab: (callback: (tab: 'settings' | 'edit' | 'other') => void) => void;
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
  getSettings: () => Promise<AppSettings>;
  setMultipleSettings: (settings: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  validateHotkey: (hotkey: string) => Promise<{ isValid: boolean; reason?: string }>;
  changeHotkey: (newHotkey: string) => Promise<boolean>;
  isFirstLaunch: () => Promise<boolean>;
  updateItem: (request: {
    sourceFile: string;
    lineNumber: number;
    newItem: LauncherItem;
  }) => Promise<{ success: boolean }>;
  updateRawLine: (request: {
    sourceFile: string;
    lineNumber: number;
    newContent: string;
  }) => Promise<{ success: boolean }>;
  deleteItems: (
    requests: {
      sourceFile: string;
      lineNumber: number;
    }[]
  ) => Promise<{ success: boolean }>;
  batchUpdateItems: (
    requests: {
      sourceFile: string;
      lineNumber: number;
      newItem: LauncherItem;
    }[]
  ) => Promise<{ success: boolean }>;
  loadRawDataFiles: () => Promise<RawDataLine[]>;
  saveRawDataFiles: (rawLines: RawDataLine[]) => Promise<void>;
  setEditMode: (editMode: boolean) => Promise<void>;
  getEditMode: () => Promise<boolean>;
  selectBookmarkFile: () => Promise<string | null>;
  parseBookmarkFile: (filePath: string) => Promise<SimpleBookmarkItem[]>;
  // ブラウザブックマーク直接インポートAPI
  detectInstalledBrowsers: () => Promise<BrowserInfo[]>;
  parseBrowserBookmarks: (filePath: string) => Promise<SimpleBookmarkItem[]>;
  showEditWindow: () => Promise<void>;
  hideEditWindow: () => Promise<void>;
  toggleEditWindow: () => Promise<void>;
  isEditWindowShown: () => Promise<boolean>;
  openEditWindowWithTab: (tab: 'settings' | 'edit' | 'other') => Promise<void>;
  getInitialTab: () => Promise<'settings' | 'edit' | 'other'>;
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
    addItem: (item: AppItem) => Promise<WorkspaceItem>;
    addItemsFromPaths: (filePaths: string[]) => Promise<WorkspaceItem[]>;
    removeItem: (id: string) => Promise<{ success: boolean }>;
    updateDisplayName: (id: string, displayName: string) => Promise<{ success: boolean }>;
    reorderItems: (itemIds: string[]) => Promise<{ success: boolean }>;
    launchItem: (item: WorkspaceItem) => Promise<{ success: boolean }>;
    // グループ管理
    loadGroups: () => Promise<WorkspaceGroup[]>;
    createGroup: (name: string, color?: string) => Promise<WorkspaceGroup>;
    updateGroup: (id: string, updates: Partial<WorkspaceGroup>) => Promise<{ success: boolean }>;
    deleteGroup: (id: string, deleteItems: boolean) => Promise<{ success: boolean }>;
    reorderGroups: (groupIds: string[]) => Promise<{ success: boolean }>;
    moveItemToGroup: (itemId: string, groupId?: string) => Promise<{ success: boolean }>;
    // 実行履歴
    loadExecutionHistory: () => Promise<ExecutionHistoryItem[]>;
    addExecutionHistory: (item: AppItem) => Promise<{ success: boolean }>;
    clearExecutionHistory: () => Promise<{ success: boolean }>;
    // ピン留め関連
    getAlwaysOnTop: () => Promise<boolean>;
    toggleAlwaysOnTop: () => Promise<boolean>;
    // モーダルモード関連
    setModalMode: (isModal: boolean, requiredSize?: { width: number; height: number }) => void;
    // サイズ変更関連
    setSize: (width: number, height: number) => Promise<boolean>;
    setPositionAndSize: (x: number, y: number, width: number, height: number) => Promise<boolean>;
    // ウィンドウ制御
    hideWindow: () => Promise<boolean>;
  };
  // ワークスペースウィンドウ制御API
  toggleWorkspaceWindow: () => Promise<void>;
  showWorkspaceWindow: () => Promise<void>;
  hideWorkspaceWindow: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
