import { useState, useEffect } from 'react';

import { debugLog } from '../utils/debug';
import { getPathsFromDropEvent } from '../utils/fileDropUtils';

/**
 * ドラッグ&ドロップ管理フック
 *
 * ファイルのドラッグ&ドロップイベントを管理します。
 */
export function useDragAndDrop(
  onFilesDropped: (paths: string[]) => void,
  onDropError: (message: string) => void,
  isModalOpen: boolean = false
) {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    // モーダルが開いている場合はイベントリスナーを設定しない
    if (isModalOpen) {
      setIsDraggingOver(false);
      return;
    }

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

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      const paths = getPathsFromDropEvent(e);
      debugLog('Final paths:', paths);

      if (paths.length > 0) {
        onFilesDropped(paths);
      } else if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
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
  }, [onFilesDropped, onDropError, isModalOpen]);

  return {
    isDraggingOver,
  };
}
