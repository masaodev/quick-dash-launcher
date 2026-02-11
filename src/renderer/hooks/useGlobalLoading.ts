import { useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

/** 最低表示時間（ミリ秒）- 処理が一瞬で終わってもこの時間は必ず表示される */
const MIN_DISPLAY_TIME = 600;

/** ローディングトーストの固定ID（同一フック内でトーストを一意に管理） */
const LOADING_TOAST_ID = 'global-loading';

/** ローディングトーストの共通スタイル */
const LOADING_TOAST_STYLE = {
  background: 'var(--color-white)',
  color: 'var(--text-muted)',
} as const;

/**
 * グローバルローディング状態管理フック
 *
 * react-hot-toastのloadingトーストとして表示します。
 * 他のトーストと自動的にスタッキングされるため、表示が重なりません。
 * 最低表示時間（600ms）を設けているため、処理が一瞬で終わっても必ず見えます。
 *
 * @example
 * const { withLoading } = useGlobalLoading();
 * await withLoading('データ読み込み中', () => loadItems());
 */
export function useGlobalLoading(): {
  withLoading: <T>(loadingMessage: string, fn: () => Promise<T>) => Promise<T>;
} {
  const showTimeRef = useRef(0);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // クリーンアップ：アンマウント時にタイムアウトとトーストをクリア
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      toast.dismiss(LOADING_TOAST_ID);
    };
  }, []);

  const dismissLoading = useCallback(() => {
    toast.dismiss(LOADING_TOAST_ID);
  }, []);

  const showLoading = useCallback((message: string) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    showTimeRef.current = Date.now();
    toast.loading(message, { id: LOADING_TOAST_ID, style: LOADING_TOAST_STYLE });
  }, []);

  const hideLoading = useCallback(() => {
    const elapsed = Date.now() - showTimeRef.current;
    const remaining = MIN_DISPLAY_TIME - elapsed;

    if (remaining > 0) {
      hideTimeoutRef.current = setTimeout(dismissLoading, remaining);
    } else {
      dismissLoading();
    }
  }, [dismissLoading]);

  const withLoading = useCallback(
    async <T>(loadingMessage: string, fn: () => Promise<T>): Promise<T> => {
      showLoading(loadingMessage);
      try {
        return await fn();
      } finally {
        hideLoading();
      }
    },
    [showLoading, hideLoading]
  );

  return { withLoading };
}
