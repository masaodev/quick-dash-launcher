import { useState, useEffect } from 'react';

import { debugLog } from '../utils/debug';
import { getPathsFromDropEvent, getUrlsFromDropEvent } from '../utils/fileDropUtils';

/** ファイルのドラッグ&ドロップイベントを管理するフック */
export function useDragAndDrop(
  onFilesDropped: (paths: string[]) => void,
  onDropError: (message: string) => void,
  isModalOpen: boolean = false
): { isDraggingOver: boolean } {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    if (isModalOpen) {
      setIsDraggingOver(false);
      return;
    }

    function preventDefaultAndStop(e: DragEvent): void {
      e.preventDefault();
      e.stopPropagation();
    }

    function handleDragOver(e: DragEvent): void {
      preventDefaultAndStop(e);
      setIsDraggingOver(true);
    }

    function handleDragLeave(e: DragEvent): void {
      preventDefaultAndStop(e);
      setIsDraggingOver(false);
    }

    function handleDrop(e: DragEvent): void {
      preventDefaultAndStop(e);
      setIsDraggingOver(false);

      // ファイルパスの抽出を試行
      const paths = getPathsFromDropEvent(e);
      debugLog('Final paths:', paths);
      if (paths.length > 0) {
        onFilesDropped(paths);
        return;
      }

      // ファイルがなければURLの抽出を試行（ブラウザからのドラッグ&ドロップ）
      const urls = getUrlsFromDropEvent(e);
      debugLog('Dropped URLs:', urls);
      if (urls.length > 0) {
        onFilesDropped(urls);
        return;
      }

      // ファイルはあるがパス取得に失敗した場合のエラー通知
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        onDropError(
          'ファイルパスを取得できませんでした。\nファイルを直接エクスプローラーからドラッグしてください。'
        );
      }
    }

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [onFilesDropped, onDropError, isModalOpen]);

  return { isDraggingOver };
}
