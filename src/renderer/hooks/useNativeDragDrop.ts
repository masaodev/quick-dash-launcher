import { useState, useEffect } from 'react';

/**
 * ワークスペースのネイティブドラッグ&ドロップ処理を管理するカスタムフック
 *
 * ファイルエクスプローラーやブラウザからのファイル・URLドロップを処理し、
 * ワークスペースにアイテムを追加します。
 *
 * @param onItemsAdded アイテム追加完了時のコールバック
 * @returns ドラッグオーバー状態
 *
 * @example
 * ```tsx
 * const { isDraggingOver } = useNativeDragDrop(() => {
 *   loadItems(); // アイテムを再読み込み
 * });
 *
 * <div className={isDraggingOver ? 'dragging-over' : ''}>
 *   ...
 * </div>
 * ```
 */
export function useNativeDragDrop(onItemsAdded: () => void) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    /**
     * ドラッグオーバー時のハンドラー
     */
    const handleNativeDragOver = (e: DragEvent) => {
      // ファイルまたはURLがドラッグされている場合に反応
      if (e.dataTransfer?.types) {
        const hasFiles = e.dataTransfer.types.includes('Files');
        const hasUrl =
          e.dataTransfer.types.includes('text/uri-list') ||
          e.dataTransfer.types.includes('text/plain');

        if (hasFiles || hasUrl) {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(true);
        }
      }
    };

    /**
     * ドラッグリーブ時のハンドラー
     */
    const handleNativeDragLeave = (e: DragEvent) => {
      // ファイルまたはURLがドラッグされている場合に反応
      if (e.dataTransfer?.types) {
        const hasFiles = e.dataTransfer.types.includes('Files');
        const hasUrl =
          e.dataTransfer.types.includes('text/uri-list') ||
          e.dataTransfer.types.includes('text/plain');

        if (hasFiles || hasUrl) {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);
        }
      }
    };

    /**
     * ドロップ時のハンドラー
     */
    const handleNativeDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      // ファイルのドロップを処理
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const filePaths: string[] = [];

        // メイン画面と同じ方法でファイルパスを取得
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const file = e.dataTransfer.files[i];
          try {
            const filePath = window.electronAPI.getPathForFile(file);
            if (filePath) {
              filePaths.push(filePath);
            }
          } catch (error) {
            console.error(`Error getting path for ${file.name}:`, error);
          }
        }

        if (filePaths.length > 0) {
          try {
            await window.electronAPI.workspaceAPI.addItemsFromPaths(filePaths);
            onItemsAdded();
          } catch (error) {
            console.error('Failed to add items from drag & drop:', error);
          }
        }
      }
      // URLのドロップを処理
      else if (e.dataTransfer) {
        const urlData =
          e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');

        if (urlData) {
          // 複数のURLが改行で区切られている場合に対応
          const urls = urlData
            .split('\n')
            .map((url) => url.trim())
            .filter((url) => url && url.startsWith('http'));

          if (urls.length > 0) {
            try {
              // URLごとにファビコンを取得してアイテムを追加
              for (const url of urls) {
                // ファビコンを取得
                let icon: string | undefined;
                try {
                  const fetchedIcon = await window.electronAPI.fetchFavicon(url);
                  icon = fetchedIcon || undefined;
                } catch (error) {
                  console.warn('Failed to fetch favicon for URL:', url, error);
                }

                const item = {
                  name: url,
                  path: url,
                  type: 'url' as const,
                  icon,
                };
                await window.electronAPI.workspaceAPI.addItem(item);
              }

              onItemsAdded();
            } catch (error) {
              console.error('Failed to add URLs from drag & drop:', error);
            }
          }
        }
      }
    };

    // ネイティブイベントリスナーを追加
    document.addEventListener('dragover', handleNativeDragOver);
    document.addEventListener('dragleave', handleNativeDragLeave);
    document.addEventListener('drop', handleNativeDrop);

    return () => {
      document.removeEventListener('dragover', handleNativeDragOver);
      document.removeEventListener('dragleave', handleNativeDragLeave);
      document.removeEventListener('drop', handleNativeDrop);
    };
  }, [onItemsAdded]);

  return { isDraggingOver };
}
