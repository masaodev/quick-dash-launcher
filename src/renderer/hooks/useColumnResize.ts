import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';

/**
 * テーブル列の幅をドラッグで変える
 *
 * @param minWidth 最小幅（px）
 * @returns width（未変更なら null）、見出しセルに付ける ref、リサイズハンドルの onMouseDown
 */
export function useColumnResize(minWidth = 100) {
  const [width, setWidth] = useState<number | null>(null);
  const headerRef = useRef<HTMLTableCellElement>(null);
  const stateRef = useRef({ isResizing: false, startX: 0, startWidth: 0 });

  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const th = headerRef.current;
    if (!th) return;
    stateRef.current = {
      isResizing: true,
      startX: e.clientX,
      startWidth: th.getBoundingClientRect().width,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const state = stateRef.current;
      if (!state.isResizing) return;
      setWidth(Math.max(minWidth, state.startWidth + e.clientX - state.startX));
    };
    const handleMouseUp = () => {
      if (!stateRef.current.isResizing) return;
      stateRef.current.isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minWidth]);

  return { width, headerRef, handleMouseDown };
}
