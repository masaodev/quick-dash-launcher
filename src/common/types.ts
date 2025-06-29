export interface LauncherItem {
  name: string;
  path: string;
  type: 'url' | 'file' | 'folder' | 'app' | 'uri';
  icon?: string;
  args?: string;
}

export interface DataFile {
  name: string;
  content: string;
}

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
  onWindowShown: (callback: () => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}