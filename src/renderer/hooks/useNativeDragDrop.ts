import { useState, useEffect } from 'react';

import { logError } from '../utils/debug';

import { useFileOperations } from './useFileOperations';

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
  const { extractFilePaths, addItemsFromFilePaths, addUrlItem } = useFileOperations();

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
        const filePaths = await extractFilePaths(e.dataTransfer.files);
        await addItemsFromFilePaths(filePaths, onItemsAdded);
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
              // URLごとにアイテムを追加
              for (const url of urls) {
                await addUrlItem(url, () => {});
              }
              onItemsAdded();
            } catch (error) {
              logError('Failed to add URLs from drag & drop:', error);
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
  }, [onItemsAdded, extractFilePaths, addItemsFromFilePaths, addUrlItem]);

  return { isDraggingOver };
}
