/**
 * モーダル表示時のウィンドウサイズ管理ユーティリティ
 *
 * モーダル表示時に必要なサイズへの拡大と、閉じる時の元サイズへの復元を管理する
 */

import type { Rectangle } from 'electron';

export interface WindowSize {
  width: number;
  height: number;
}

/**
 * モーダル表示に必要なサイズを計算する
 * 現在のサイズと必要なサイズを比較し、拡大が必要かどうかを判定
 */
export function calculateModalSize(
  currentBounds: Rectangle,
  requiredSize: WindowSize
): { needsResize: boolean; newSize: WindowSize } {
  const needsResize =
    currentBounds.width < requiredSize.width || currentBounds.height < requiredSize.height;

  return {
    needsResize,
    newSize: {
      width: Math.max(currentBounds.width, requiredSize.width),
      height: Math.max(currentBounds.height, requiredSize.height),
    },
  };
}
