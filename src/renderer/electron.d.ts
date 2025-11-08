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
} from '../common/types';

import { RegisterItem } from './components/RegisterModal';

export interface ElectronAPI {
  getConfigFolder: () => Promise<string>;
  loadDataFiles: () => Promise<AppItem[]>;
  openItem: (item: LauncherItem) => Promise<void>;
  openParentFolder: (item: LauncherItem) => Promise<void>;
  executeGroup: (group: GroupItem, allItems: AppItem[]) => Promise<void>;
  openConfigFolder: () => Promise<void>;
  openDataFile: () => Promise<void>;
  fetchFavicon: (url: string) => Promise<string | null>;
  extractIcon: (filePath: string) => Promise<string | null>;
  extractFileIconByExtension: (filePath: string) => Promise<string | null>;
  extractCustomUriIcon: (uri: string) => Promise<string | null>;
  loadCachedIcons: (items: LauncherItem[]) => Promise<Record<string, string>>;
  // 進捗付きアイコン取得API
  fetchFaviconsWithProgress: (urls: string[]) => Promise<Record<string, string | null>>;
  extractIconsWithProgress: (items: LauncherItem[]) => Promise<Record<string, string | null>>;
  // 進捗イベントリスナー
  onIconProgress: (
    eventType: 'start' | 'update' | 'complete',
    callback: (data: IconProgress) => void
  ) => void;
  onWindowShown: (callback: () => void) => void;
  onSetActiveTab: (callback: (tab: 'settings' | 'edit' | 'other') => void) => void;
  onDataChanged: (callback: () => void) => void;
  // 新しい3段階ピンモードAPI
  getWindowPinMode: () => Promise<WindowPinMode>;
  cycleWindowPinMode: () => Promise<WindowPinMode>;
  // 旧APIとの互換性（非推奨）
  getWindowPinState: () => Promise<boolean>;
  setWindowPinState: (isPinned: boolean) => Promise<void>;
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
    sourceFile: 'data.txt' | 'data2.txt';
    lineNumber: number;
    newItem: LauncherItem;
  }) => Promise<{ success: boolean }>;
  deleteItems: (
    requests: {
      sourceFile: 'data.txt' | 'data2.txt';
      lineNumber: number;
    }[]
  ) => Promise<{ success: boolean }>;
  batchUpdateItems: (
    requests: {
      sourceFile: 'data.txt' | 'data2.txt';
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
