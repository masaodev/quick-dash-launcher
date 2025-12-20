/**
 * ファイルとURL操作の共通ユーティリティフック
 *
 * useNativeDragDropとuseClipboardPasteで共有される処理を提供します。
 */
export function useFileOperations() {
  /**
   * Fileオブジェクトからファイルパスのリストを取得
   * @param files FileListオブジェクト
   * @returns ファイルパスの配列
   */
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
        console.error(`Error getting path for ${file.name}:`, error);
      }
    }

    return filePaths;
  };

  /**
   * ファイルパスのリストからワークスペースにアイテムを追加
   * @param filePaths ファイルパスの配列
   * @param onItemsAdded 追加完了時のコールバック
   * @param groupId オプションのグループID（指定された場合、そのグループに追加）
   */
  const addItemsFromFilePaths = async (
    filePaths: string[],
    onItemsAdded: () => void,
    groupId?: string
  ): Promise<void> => {
    if (filePaths.length > 0) {
      try {
        await window.electronAPI.workspaceAPI.addItemsFromPaths(filePaths, groupId);
        onItemsAdded();
      } catch (error) {
        console.error('Failed to add items from file paths:', error);
      }
    }
  };

  /**
   * URLのファビコンを取得（エラー時はundefinedを返す）
   * @param url URL文字列
   * @returns ファビコンのデータURL、または取得失敗時はundefined
   */
  const fetchFaviconSafely = async (url: string): Promise<string | undefined> => {
    try {
      const fetchedIcon = await window.electronAPI.fetchFavicon(url);
      return fetchedIcon || undefined;
    } catch (error) {
      console.warn('Failed to fetch favicon for URL:', url, error);
      return undefined;
    }
  };

  /**
   * URLをワークスペースに追加
   * @param url URL文字列
   * @param onItemsAdded 追加完了時のコールバック
   * @param groupId オプションのグループID（指定された場合、そのグループに追加）
   */
  const addUrlItem = async (
    url: string,
    onItemsAdded: () => void,
    groupId?: string
  ): Promise<void> => {
    try {
      // ファビコンを取得
      const icon = await fetchFaviconSafely(url);

      // アイテムを追加
      const item = {
        name: url,
        path: url,
        type: 'url' as const,
        icon,
      };

      await window.electronAPI.workspaceAPI.addItem(item, groupId);
      onItemsAdded();
    } catch (error) {
      console.error('Failed to add URL item:', error);
    }
  };

  return {
    extractFilePaths,
    addItemsFromFilePaths,
    fetchFaviconSafely,
    addUrlItem,
  };
}
