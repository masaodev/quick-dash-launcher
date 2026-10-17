import type { WorkspaceItem } from '@common/types';

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

  /**
   * パスからワークスペースへ足す。足せたアイテムを返す（足せなかったものは本体側がトーストで知らせる）
   */
  const addItemsFromFilePaths = async (
    filePaths: string[],
    onItemsAdded: () => void,
    groupId?: string,
    workspaceId?: string
  ): Promise<WorkspaceItem[]> => {
    if (filePaths.length === 0) return [];
    try {
      const added = await window.electronAPI.workspaceAPI.addItemsFromPaths(
        filePaths,
        groupId,
        workspaceId
      );
      onItemsAdded();
      return added;
    } catch (error) {
      logError('Failed to add items from file paths:', error);
      return [];
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

  /** URL をワークスペースへ足す。足せたか返す（失敗は本体側がトーストで知らせる） */
  const addUrlItem = async (
    url: string,
    onItemsAdded: () => void,
    groupId?: string,
    workspaceId?: string
  ): Promise<boolean> => {
    try {
      const icon = await fetchFaviconSafely(url);
      await window.electronAPI.workspaceAPI.addItem(
        { displayName: url, path: url, type: 'url' as const, icon },
        groupId,
        workspaceId
      );
      onItemsAdded();
      return true;
    } catch (error) {
      logError('Failed to add URL item:', error);
      return false;
    }
  };

  return {
    extractFilePaths,
    addItemsFromFilePaths,
    fetchFaviconSafely,
    addUrlItem,
  };
}
