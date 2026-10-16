import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceItem } from '@common/types';
import { WORKSPACE_ITEM_DRAG_TYPE } from '@common/constants';

import { debugLog, logError } from '../utils/debug';
import { getPathsFromDropEvent, getUrlsFromDropEvent } from '../utils/fileDropUtils';

/** ドラッグ中のもの（ファイル・URL か、ワークスペースのアイテムか） */
export type DragOverKind = 'files' | 'workspaceItem';

/** dataTransfer.types は小文字になる */
function isWorkspaceItemDrag(e: DragEvent): boolean {
  return !!e.dataTransfer?.types.includes(WORKSPACE_ITEM_DRAG_TYPE.toLowerCase());
}

/**
 * 落とせば登録できるもの（ファイル・URL・テキスト）を持つドラッグか
 *
 * ワークスペースのグループのように、どれも持たないドラッグでは「ドロップして登録」を出さない（落としても何も起きないため）
 */
function hasDroppableData(e: DragEvent): boolean {
  const types = e.dataTransfer?.types ?? [];
  return types.includes('Files') || types.includes('text/uri-list') || types.includes('text/plain');
}

/** ファイル・URL とワークスペースのアイテムのドラッグ&ドロップイベントを管理するフック */
export function useDragAndDrop(
  onFilesDropped: (paths: string[]) => void,
  onDropError: (message: string) => void,
  isModalOpen: boolean = false,
  onWorkspaceItemDropped?: (item: WorkspaceItem) => void
): { isDraggingOver: boolean; dragOverKind: DragOverKind | null } {
  const { t } = useTranslation();
  const [dragOverKind, setDragOverKind] = useState<DragOverKind | null>(null);

  useEffect(() => {
    if (isModalOpen) {
      setDragOverKind(null);
      return;
    }

    function preventDefaultAndStop(e: DragEvent): void {
      e.preventDefault();
      e.stopPropagation();
    }

    // dragenter・dragleave は子要素をまたぐたびに対で起きる。数えて、ウィンドウの外へ出たとき（0 に戻ったとき）だけ消す
    // （dragleave のたびに消すと、出たり消えたりしてちらつく）
    let enterDepth = 0;

    function handleDragEnter(e: DragEvent): void {
      preventDefaultAndStop(e);
      enterDepth += 1;
    }

    function handleDragOver(e: DragEvent): void {
      preventDefaultAndStop(e);
      if (onWorkspaceItemDropped && isWorkspaceItemDrag(e)) {
        setDragOverKind('workspaceItem');
      } else {
        setDragOverKind(hasDroppableData(e) ? 'files' : null);
      }
    }

    function handleDragLeave(e: DragEvent): void {
      preventDefaultAndStop(e);
      enterDepth = Math.max(0, enterDepth - 1);
      if (enterDepth === 0) setDragOverKind(null);
    }

    function handleDrop(e: DragEvent): void {
      preventDefaultAndStop(e);
      enterDepth = 0;
      setDragOverKind(null);

      // ワークスペースのアイテム（ファイル・URL より先に見る。テキストとしても読めるため）
      const workspaceItemData = e.dataTransfer?.getData(WORKSPACE_ITEM_DRAG_TYPE);
      if (workspaceItemData && onWorkspaceItemDropped) {
        try {
          onWorkspaceItemDropped(JSON.parse(workspaceItemData) as WorkspaceItem);
        } catch (error) {
          logError('ワークスペースのアイテムを読み取れませんでした:', error);
        }
        return;
      }

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
        onDropError(t('launcher.dropPathUnavailable'));
      }
    }

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [onFilesDropped, onDropError, onWorkspaceItemDropped, isModalOpen, t]);

  return { isDraggingOver: dragOverKind !== null, dragOverKind };
}
