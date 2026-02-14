import { logError, logWarn } from '../utils/debug';

export function useFileOperations() {
  const extractFilePaths = async (files: FileList): Promise<string[]> => {
    const filePaths: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const filePath = window.electronAPI.getPathForFile(file);
        if (filePath) {
          filePaths.push(filePath);
        }
      } catch (error) {
        logError(`Error getting path for ${file.name}:`, error);
      }
    }

    return filePaths;
  };

  const addItemsFromFilePaths = async (
    filePaths: string[],
    onItemsAdded: () => void,
    groupId?: string
  ): Promise<void> => {
    if (filePaths.length === 0) return;
    try {
      await window.electronAPI.workspaceAPI.addItemsFromPaths(filePaths, groupId);
      onItemsAdded();
    } catch (error) {
      logError('Failed to add items from file paths:', error);
    }
  };

  const fetchFaviconSafely = async (url: string): Promise<string | undefined> => {
    try {
      const fetchedIcon = await window.electronAPI.fetchFavicon(url);
      return fetchedIcon || undefined;
    } catch (error) {
      logWarn('Failed to fetch favicon for URL:', url, error);
      return undefined;
    }
  };

  const addUrlItem = async (
    url: string,
    onItemsAdded: () => void,
    groupId?: string
  ): Promise<void> => {
    try {
      const icon = await fetchFaviconSafely(url);
      await window.electronAPI.workspaceAPI.addItem(
        { displayName: url, path: url, type: 'url' as const, icon },
        groupId
      );
      onItemsAdded();
    } catch (error) {
      logError('Failed to add URL item:', error);
    }
  };

  return {
    extractFilePaths,
    addItemsFromFilePaths,
    fetchFaviconSafely,
    addUrlItem,
  };
}
