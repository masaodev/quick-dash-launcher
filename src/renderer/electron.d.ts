import { LauncherItem, DataFile } from '../common/types';

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
  loadCachedIcons: (items: LauncherItem[]) => Promise<Record<string, string>>;
  onWindowShown: (callback: () => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}