import React, { useCallback, useRef } from 'react';

type SetBoundsFn = (x: number, y: number, width: number, height: number) => void;

interface UseWorkspaceResizeOptions {
  setBoundsFn?: SetBoundsFn;
  minWidth?: number;
  minHeight?: number;
}

function defaultSetBounds(x: number, y: number, width: number, height: number): void {
  window.electronAPI.workspaceAPI.setPositionAndSize(x, y, width, height);
}

/**
 * ワークスペースウィンドウのサイズ変更を管理するカスタムフック
 * マウスイベントを使用してウィンドウの端をドラッグしてサイズ変更を実現
 */
export function useWorkspaceResize(options?: UseWorkspaceResizeOptions): {
  handleResize: (direction: string) => (e: React.MouseEvent) => void;
} {
  const setBounds = options?.setBoundsFn ?? defaultSetBounds;
  const setBoundsRef = useRef(setBounds);
  setBoundsRef.current = setBounds;
  const minWidth = options?.minWidth ?? 300;
  const minHeight = options?.minHeight ?? 400;

  const handleResize = useCallback(
    (direction: string) => {
      return (e: React.MouseEvent) => {
        e.preventDefault();

        const startX = e.screenX;
        const startY = e.screenY;
        const startWidth = window.outerWidth;
        const startHeight = window.outerHeight;
        const startScreenX = window.screenX;
        const startScreenY = window.screenY;

        const handleMouseMove = (moveEvent: MouseEvent) => {
          const deltaX = moveEvent.screenX - startX;
          const deltaY = moveEvent.screenY - startY;

          let newWidth = startWidth;
          let newHeight = startHeight;
          let newX = startScreenX;
          let newY = startScreenY;

          if (direction.includes('right')) {
            newWidth = Math.max(minWidth, startWidth + deltaX);
          } else if (direction.includes('left')) {
            newWidth = Math.max(minWidth, startWidth - deltaX);
            newX = startScreenX + (startWidth - newWidth);
          }

          if (direction.includes('bottom')) {
            newHeight = Math.max(minHeight, startHeight + deltaY);
          } else if (direction.includes('top')) {
            newHeight = Math.max(minHeight, startHeight - deltaY);
            newY = startScreenY + (startHeight - newHeight);
          }

          setBoundsRef.current(newX, newY, newWidth, newHeight);
        };

        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      };
    },
    [minWidth, minHeight]
  );

  return { handleResize };
}
