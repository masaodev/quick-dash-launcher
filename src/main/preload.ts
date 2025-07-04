import { contextBridge, ipcRenderer } from 'electron';
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
});