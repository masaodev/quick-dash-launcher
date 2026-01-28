import React, { useCallback } from 'react';

/**
 * ワークスペースウィンドウのサイズ変更を管理するカスタムフック
 * マウスイベントを使用してウィンドウの端をドラッグしてサイズ変更を実現
 */
export function useWorkspaceResize(): {
  handleResize: (direction: string) => (e: React.MouseEvent) => void;
} {
  /**
   * サイズ変更ハンドラーを生成
   * @param direction サイズ変更の方向（'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'）
   * @returns マウスダウンイベントハンドラー
   */
  const handleResize = useCallback((direction: string) => {
    return (e: React.MouseEvent) => {
      e.preventDefault();

      // 初期値を記録
      const startX = e.screenX;
      const startY = e.screenY;
      const startWidth = window.outerWidth;
      const startHeight = window.outerHeight;
      const startScreenX = window.screenX;
      const startScreenY = window.screenY;

      /**
       * マウス移動時の処理
       */
      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.screenX - startX;
        const deltaY = moveEvent.screenY - startY;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newX = startScreenX;
        let newY = startScreenY;

        // 方向に応じてサイズと位置を計算
        if (direction.includes('right')) {
          newWidth = Math.max(300, startWidth + deltaX);
        } else if (direction.includes('left')) {
          newWidth = Math.max(300, startWidth - deltaX);
          // 左辺を動かす場合、x座標も調整
          newX = startScreenX + (startWidth - newWidth);
        }

        if (direction.includes('bottom')) {
          newHeight = Math.max(400, startHeight + deltaY);
        } else if (direction.includes('top')) {
          newHeight = Math.max(400, startHeight - deltaY);
          // 上辺を動かす場合、y座標も調整
          newY = startScreenY + (startHeight - newHeight);
        }

        // ウィンドウサイズと位置を変更（絶対座標）
        window.electronAPI.workspaceAPI.setPositionAndSize(newX, newY, newWidth, newHeight);
      };

      /**
       * マウスアップ時の処理（イベントリスナーをクリーンアップ）
       */
      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      // イベントリスナーを登録
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return { handleResize };
}
