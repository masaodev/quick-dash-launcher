import { useState, useEffect } from 'react';

import { debugLog, logError } from '../utils/debug';

/**
 * ドラッグ&ドロップ管理フック
 *
 * ファイルのドラッグ&ドロップイベントを管理します。
 */
export function useDragAndDrop(
  onFilesDropped: (paths: string[]) => void,
  onDropError: (message: string) => void
) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    // Setup drag and drop event listeners
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      // Check if we have files
      if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) {
        return;
      }

      const paths: string[] = [];
      const files = e.dataTransfer.files;

      // Use webUtils.getPathForFile() through the preload API
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const filePath = window.electronAPI.getPathForFile(file);
          debugLog(`Got path for ${file.name}: ${filePath}`);
          if (filePath) {
            paths.push(filePath);
          }
        } catch (error) {
          logError(`Error getting path for ${file.name}:`, error);
        }
      }

      debugLog('Final paths:', paths);

      if (paths.length > 0) {
        onFilesDropped(paths);
      } else {
        onDropError(
          'ファイルパスを取得できませんでした。\nファイルを直接エクスプローラーからドラッグしてください。'
        );
      }
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [onFilesDropped, onDropError]);

  return {
    isDraggingOver,
  };
}
