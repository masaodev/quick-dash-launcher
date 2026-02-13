import { useCallback, useRef } from 'react';

const MIN_HEIGHT = 150;

/**
 * ワークスペースウィンドウの高さをコンテンツに合わせて自動調整するフック
 *
 * contentRef（WorkspaceGroupedList内部ラッパー）をResizeObserverで監視し、
 * コンテンツ高さの変化に応じてウィンドウ高さをsetSizeで更新する。
 *
 * callback refパターンを使用し、要素のアタッチ/デタッチに正しく対応する。
 */
export function useWorkspaceAutoFit(): {
  contentRef: (node: HTMLDivElement | null) => void;
} {
  const lastHeightRef = useRef<number>(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const updateHeight = useCallback((contentEl: HTMLElement) => {
    const workspaceWindow = contentEl.closest('.workspace-window') as HTMLElement | null;
    if (!workspaceWindow) return;

    const itemList = contentEl.parentElement;
    if (!itemList) return;

    // itemListより前の兄弟要素（ヘッダー、フィルターバー等）の高さ合計
    let headerHeight = 0;
    for (let el = itemList.previousElementSibling; el; el = el.previousElementSibling) {
      headerHeight += el.getBoundingClientRect().height;
    }

    // itemListのpadding（上下合計）
    const itemListStyle = getComputedStyle(itemList);
    const itemListPadding =
      (parseFloat(itemListStyle.paddingTop) || 0) + (parseFloat(itemListStyle.paddingBottom) || 0);

    // workspace-windowのborder（上下合計: offsetHeight - clientHeight）
    const windowBorder = workspaceWindow.offsetHeight - workspaceWindow.clientHeight;

    const desiredHeight = headerHeight + itemListPadding + contentEl.scrollHeight + windowBorder;

    const maxHeight = window.screen.availHeight;
    const clampedHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, Math.ceil(desiredHeight)));

    // 差が2px以内なら更新しない（ループ防止）
    if (Math.abs(clampedHeight - lastHeightRef.current) <= 2) return;

    lastHeightRef.current = clampedHeight;
    window.electronAPI.workspaceAPI.setSize(window.outerWidth, clampedHeight);
  }, []);

  const contentRef = useCallback(
    (node: HTMLDivElement | null) => {
      // 前の要素の監視を解除
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node) return;

      const observer = new ResizeObserver(() => {
        updateHeight(node);
      });

      observer.observe(node);
      observerRef.current = observer;

      // 初回実行
      updateHeight(node);
    },
    [updateHeight]
  );

  return { contentRef };
}
