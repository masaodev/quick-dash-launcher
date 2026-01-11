import React from 'react';
import type { DragItemData } from '@common/types';
import { isDragItemData } from '@common/utils/typeGuards';

import { logError } from '../../utils/debug';

/**
 * ワークスペースのドラッグ&ドロップ処理を型安全に管理するカスタムフック
 *
 * このフックは、ドラッグ&ドロップイベントでやり取りされるデータを
 * 型安全に扱うためのヘルパー関数を提供します。
 *
 * @returns ドラッグ&ドロップ処理のヘルパー関数
 *
 * @example
 * ```tsx
 * const { setDragData, getDragData } = useWorkspaceDragDrop();
 *
 * // ドラッグ開始時
 * const handleDragStart = (item: WorkspaceItem) => (e: React.DragEvent) => {
 *   setDragData(e, {
 *     type: 'workspace-item',
 *     itemId: item.id,
 *     currentGroupId: item.groupId
 *   });
 * };
 *
 * // ドロップ時
 * const handleDrop = (e: React.DragEvent) => {
 *   const data = getDragData(e);
 *   if (data && data.type === 'workspace-item') {
 *     console.log('Dropped item:', data.itemId);
 *   }
 * };
 * ```
 */
export function useWorkspaceDragDrop() {
  /**
   * ドラッグイベントにデータを設定
   *
   * @param e ドラッグイベント
   * @param data 転送するデータ（型安全）
   */
  const setDragData = (e: React.DragEvent, data: DragItemData) => {
    e.dataTransfer.setData('application/json', JSON.stringify(data));
  };

  /**
   * ドラッグイベントからデータを取得
   *
   * @param e ドラッグイベント
   * @returns 取得したデータ（型安全、パース失敗時はnull）
   */
  const getDragData = (e: React.DragEvent): DragItemData | null => {
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (!jsonData) {
        return null;
      }

      const parsed: unknown = JSON.parse(jsonData);
      return isDragItemData(parsed) ? parsed : null;
    } catch (error) {
      logError('Failed to parse drag data:', error);
      return null;
    }
  };

  return { setDragData, getDragData };
}
