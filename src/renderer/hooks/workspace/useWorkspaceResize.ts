import React, { useCallback } from 'react';

/**
 * ワークスペースウィンドウのサイズ変更を管理するカスタムフック
 * マウスイベントを使用してウィンドウの端をドラッグしてサイズ変更を実現
 */
export function useWorkspaceResize(): {
  handleResize: (direction: string) => (e: React.MouseEvent) => void;
} {
  const handleResize = useCallback((direction: string) => {
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
          newWidth = Math.max(300, startWidth + deltaX);
        } else if (direction.includes('left')) {
          newWidth = Math.max(300, startWidth - deltaX);
          newX = startScreenX + (startWidth - newWidth);
        }

        if (direction.includes('bottom')) {
          newHeight = Math.max(400, startHeight + deltaY);
        } else if (direction.includes('top')) {
          newHeight = Math.max(400, startHeight - deltaY);
          newY = startScreenY + (startHeight - newHeight);
        }

        window.electronAPI.workspaceAPI.setPositionAndSize(newX, newY, newWidth, newHeight);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return { handleResize };
}
