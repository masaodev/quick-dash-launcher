import type React from 'react';
import { useEffect, useRef } from 'react';

import { hasDroppableData } from '../utils/fileDropUtils';

type NativeFileDropHandler = (e: React.DragEvent) => Promise<void>;

/**
 * ワークスペースのネイティブドラッグ&ドロップ処理を管理するカスタムフック
 *
 * ファイルエクスプローラーやブラウザからのファイル・URLドロップを検知し、
 * グループレベルで処理されなかったドロップをフォールバック処理として
 * onNativeFileDrop コールバックに委譲します。
 *
 * @param onNativeFileDrop ネイティブファイル/URLドロップ時のコールバック（groupId なし）
 */
export function useNativeDragDrop(onNativeFileDrop: NativeFileDropHandler): void {
  const callbackRef = useRef(onNativeFileDrop);
  callbackRef.current = onNativeFileDrop;

  useEffect(() => {
    function handleDragOverOrLeave(e: DragEvent): void {
      if (hasDroppableData(e.dataTransfer)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    async function handleDrop(e: DragEvent): Promise<void> {
      e.preventDefault();
      e.stopPropagation();

      // グループレベルで既に処理済みの場合はスキップ
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((e as any).__handledByGroup) {
        return;
      }

      // グループ未指定としてフォールバック処理
      await callbackRef.current(e as unknown as React.DragEvent);
    }

    document.addEventListener('dragover', handleDragOverOrLeave);
    document.addEventListener('dragleave', handleDragOverOrLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragover', handleDragOverOrLeave);
      document.removeEventListener('dragleave', handleDragOverOrLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);
}
