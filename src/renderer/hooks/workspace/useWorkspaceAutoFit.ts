import { useCallback, useRef } from 'react';

type ResizeFn = (width: number, height: number) => void;

const DEFAULT_MIN_HEIGHT = 150;

function defaultResizeFn(width: number, height: number): void {
  window.electronAPI.workspaceAPI.setSize(width, height);
}

/**
 * ワークスペースウィンドウの高さをコンテンツに合わせて自動調整するフック
 *
 * contentRef（WorkspaceGroupedList内部ラッパー）をResizeObserverで監視し、
 * コンテンツ高さの変化に応じてウィンドウ高さをsetSizeで更新する。
 *
 * callback refパターンを使用し、要素のアタッチ/デタッチに正しく対応する。
 */
export function useWorkspaceAutoFit(
  resizeFn?: ResizeFn,
  minHeight?: number
): {
  contentRef: (node: HTMLDivElement | null) => void;
} {
  const effectiveMinHeight = minHeight ?? DEFAULT_MIN_HEIGHT;
  const resize = resizeFn ?? defaultResizeFn;
  const resizeRef = useRef(resize);
  resizeRef.current = resize;
  const lastHeightRef = useRef<number>(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const updateHeight = useCallback(
    (contentEl: HTMLElement) => {
      const workspaceWindow = contentEl.closest('.workspace-window') as HTMLElement | null;
      if (!workspaceWindow) return;

      const itemList = contentEl.parentElement;
      if (!itemList) return;

      let headerHeight = 0;
      for (let el = itemList.previousElementSibling; el; el = el.previousElementSibling) {
        headerHeight += el.getBoundingClientRect().height;
      }

      const style = getComputedStyle(itemList);
      const itemListPadding =
        (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
      const windowBorder = workspaceWindow.offsetHeight - workspaceWindow.clientHeight;

      const desiredHeight = headerHeight + itemListPadding + contentEl.scrollHeight + windowBorder;
      const clampedHeight = Math.max(
        effectiveMinHeight,
        Math.min(window.screen.availHeight, Math.ceil(desiredHeight))
      );

      if (Math.abs(clampedHeight - lastHeightRef.current) <= 2) return;

      lastHeightRef.current = clampedHeight;
      resizeRef.current(window.outerWidth, clampedHeight);
    },
    [effectiveMinHeight]
  );

  const contentRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node) return;

      const observer = new ResizeObserver(() => updateHeight(node));
      observer.observe(node);
      observerRef.current = observer;
      updateHeight(node);
    },
    [updateHeight]
  );

  return { contentRef };
}
