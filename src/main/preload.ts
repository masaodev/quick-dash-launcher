import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { LauncherItem } from '../common/types';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfigFolder: () => ipcRenderer.invoke('get-config-folder'),
  loadDataFiles: () => ipcRenderer.invoke('load-data-files'),
  saveTempData: (content: string) => ipcRenderer.invoke('save-temp-data', content),
  openItem: (item: LauncherItem) => ipcRenderer.invoke('open-item', item),
  openParentFolder: (item: LauncherItem) => ipcRenderer.invoke('open-parent-folder', item),
  openConfigFolder: () => ipcRenderer.invoke('open-config-folder'),
  openDataFile: () => ipcRenderer.invoke('open-data-file'),
  fetchFavicon: (url: string) => ipcRenderer.invoke('fetch-favicon', url),
  extractIcon: (filePath: string) => ipcRenderer.invoke('extract-icon', filePath),
  extractFileIconByExtension: (filePath: string) => ipcRenderer.invoke('extract-file-icon-by-extension', filePath),
  extractCustomUriIcon: (uri: string) => ipcRenderer.invoke('extract-custom-uri-icon', uri),
  loadCachedIcons: (items: LauncherItem[]) => ipcRenderer.invoke('load-cached-icons', items),
  onWindowShown: (callback: () => void) => {
    ipcRenderer.on('window-shown', callback);
  },
  getWindowPinState: () => ipcRenderer.invoke('get-window-pin-state'),
  setWindowPinState: (isPinned: boolean) => ipcRenderer.invoke('set-window-pin-state', isPinned),
  registerItems: (items: any[]) => ipcRenderer.invoke('register-items', items),
  isDirectory: (filePath: string) => ipcRenderer.invoke('is-directory', filePath),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  sortDataFiles: () => ipcRenderer.invoke('sort-data-files'),
  updateItem: (request: any) => ipcRenderer.invoke('update-item', request),
  deleteItems: (requests: any[]) => ipcRenderer.invoke('delete-items', requests),
  batchUpdateItems: (requests: any[]) => ipcRenderer.invoke('batch-update-items', requests),
  loadRawDataFiles: () => ipcRenderer.invoke('load-raw-data-files'),
  saveRawDataFiles: (rawLines: any[]) => ipcRenderer.invoke('save-raw-data-files', rawLines),
  setEditMode: (editMode: boolean) => ipcRenderer.invoke('set-edit-mode', editMode),
  getEditMode: () => ipcRenderer.invoke('get-edit-mode'),
});