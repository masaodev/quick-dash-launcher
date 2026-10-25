import { useCallback, useEffect, useRef } from 'react';

type ResizeFn = (width: number, height: number) => void;

const DEFAULT_MIN_HEIGHT = 150;

function defaultResizeFn(_width: number, height: number): void {
  window.electronAPI.workspaceAPI.setHeight(height);
}

/**
 * ワークスペースウィンドウの高さをコンテンツに合わせて自動調整するフック
 *
 * contentRef（WorkspaceGroupedList内部ラッパー）をResizeObserverで監視し、
 * コンテンツ高さの変化に応じてウィンドウ高さを更新する。
 *
 * callback refパターンを使用し、要素のアタッチ/デタッチに正しく対応する。
 * メインプロセスが高さを作業領域いっぱいに戻したとき（EVENT_WORKSPACE_REFIT_HEIGHT）は、
 * 中身の高さが変わっていなくても合わせ直す。購読するのはワークスペース本体（resizeFn を渡さない側）だけで、
 * 切り離しウィンドウは通知の届く先によらず合わせ直さない
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
  const nodeRef = useRef<HTMLDivElement | null>(null);

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

      // 差が 2px 以内なら更新しない（ループ防止）。ただし中身がはみ出して縦のスクロールバーが出ているときは、
      // 広げる分は小さくても合わせる（2px 足りずにスクロールバーが残っていた。A3-185）
      const diff = clampedHeight - lastHeightRef.current;
      const overflowing = itemList.scrollHeight > itemList.clientHeight;
      if (Math.abs(diff) <= 2 && !(overflowing && diff > 0)) return;

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

      nodeRef.current = node;
      if (!node) return;

      const observer = new ResizeObserver(() => updateHeight(node));
      observer.observe(node);
      observerRef.current = observer;
      updateHeight(node);
    },
    [updateHeight]
  );

  const refitOnRequest = resizeFn === undefined;
  useEffect(() => {
    if (!refitOnRequest) return;
    return window.electronAPI.onWorkspaceRefitHeight(() => {
      if (!nodeRef.current) return;
      lastHeightRef.current = 0;
      updateHeight(nodeRef.current);
    });
  }, [refitOnRequest, updateHeight]);

  return { contentRef };
}
