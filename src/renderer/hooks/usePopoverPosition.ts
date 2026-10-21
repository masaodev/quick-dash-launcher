import { useLayoutEffect, useState, type RefObject } from 'react';

/** 画面の端から空ける幅 */
const EDGE_MARGIN = 8;

/**
 * 画面に固定で出すメニューの位置を、描いた大きさを測って画面の内側に収める
 *
 * 右にはみ出すなら左へ、下にはみ出すなら上へずらす。画面より高いメニューは上端に合わせる
 * （中身は CSS の max-height でスクロールする）
 */
export function usePopoverPosition(
  ref: RefObject<HTMLElement | null>,
  position: { x: number; y: number }
): { left: number; top: number } {
  const [clamped, setClamped] = useState({ left: position.x, top: position.y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const maxLeft = window.innerWidth - width - EDGE_MARGIN;
    const maxTop = window.innerHeight - height - EDGE_MARGIN;
    setClamped({
      left: Math.max(EDGE_MARGIN, Math.min(position.x, maxLeft)),
      top: Math.max(EDGE_MARGIN, Math.min(position.y, maxTop)),
    });
  }, [ref, position.x, position.y]);

  return clamped;
}
