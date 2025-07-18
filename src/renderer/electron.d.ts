import {
  LauncherItem,
  DataFile,
  RawDataLine,
  SimpleBookmarkItem,
  AppSettings,
} from '../common/types';

import { RegisterItem } from './components/RegisterModal';

export interface ElectronAPI {
  getConfigFolder: () => Promise<string>;
  loadDataFiles: () => Promise<DataFile[]>;
  saveTempData: (content: string) => Promise<void>;
  openItem: (item: LauncherItem) => Promise<void>;
  openParentFolder: (item: LauncherItem) => Promise<void>;
  openConfigFolder: () => Promise<void>;
  openDataFile: () => Promise<void>;
  fetchFavicon: (url: string) => Promise<string | null>;
  extractIcon: (filePath: string) => Promise<string | null>;
  extractFileIconByExtension: (filePath: string) => Promise<string | null>;
  extractCustomUriIcon: (uri: string) => Promise<string | null>;
  loadCachedIcons: (items: LauncherItem[]) => Promise<Record<string, string>>;
  onWindowShown: (callback: () => void) => void;
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
  updateItem: (request: {
    sourceFile: 'data.txt' | 'data2.txt' | 'tempdata.txt';
    lineNumber: number;
    newItem: LauncherItem;
  }) => Promise<{ success: boolean }>;
  deleteItems: (
    requests: {
      sourceFile: 'data.txt' | 'data2.txt' | 'tempdata.txt';
      lineNumber: number;
    }[]
  ) => Promise<{ success: boolean }>;
  batchUpdateItems: (
    requests: {
      sourceFile: 'data.txt' | 'data2.txt' | 'tempdata.txt';
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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
