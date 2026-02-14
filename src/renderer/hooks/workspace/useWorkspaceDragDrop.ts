import type { DragEvent } from 'react';
import type { DragItemData } from '@common/types';
import { isDragItemData } from '@common/types/guards';

export function useWorkspaceDragDrop(): {
  setDragData: (e: DragEvent, data: DragItemData) => void;
  getDragData: (e: DragEvent) => DragItemData | null;
} {
  function setDragData(e: DragEvent, data: DragItemData): void {
    e.dataTransfer.setData('application/json', JSON.stringify(data));
  }

  function getDragData(e: DragEvent): DragItemData | null {
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (!jsonData) return null;

      const parsed = JSON.parse(jsonData);
      return isDragItemData(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return { setDragData, getDragData };
}
