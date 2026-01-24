import { useState, useCallback, useRef, useEffect } from 'react';

/** 最低表示時間（ミリ秒）- 処理が一瞬で終わってもこの時間は必ず表示される */
const MIN_DISPLAY_TIME = 600;

/**
 * グローバルローディング状態管理フック
 *
 * アプリケーション全体で使用できるローディングインジケーターの状態を管理します。
 * 画面右下に表示される小さなスピナーで、短時間の処理のフィードバックに使用します。
 * 最低表示時間（600ms）を設けているため、処理が一瞬で終わっても必ず見えます。
 *
 * @example
 * const { withLoading } = useGlobalLoading();
 *
 * // withLoadingを使う方法（推奨）
 * await withLoading('データ読み込み中', () => loadItems());
 *
 * // showLoading/hideLoadingを使う方法
 * showLoading('ウィンドウ更新中');
 * await refreshWindows();
 * hideLoading();
 */
export function useGlobalLoading(): {
  isLoading: boolean;
  message: string;
  showLoading: (loadingMessage?: string) => void;
  hideLoading: () => void;
  withLoading: <T>(loadingMessage: string, fn: () => Promise<T>) => Promise<T>;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const showTimeRef = useRef(0);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // クリーンアップ：アンマウント時にタイムアウトをクリア
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const clearLoadingState = useCallback(() => {
    setIsLoading(false);
    setMessage('');
  }, []);

  /**
   * ローディング表示を開始
   * @param loadingMessage - 表示するメッセージ（例: "更新中", "読み込み中"）
   */
  const showLoading = useCallback((loadingMessage = '処理中') => {
    // 既存のタイムアウトをクリア
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    showTimeRef.current = Date.now();
    setIsLoading(true);
    setMessage(loadingMessage);
  }, []);

  /**
   * ローディング表示を終了
   * 最低表示時間に満たない場合は、残り時間だけ待ってから非表示にする
   */
  const hideLoading = useCallback(() => {
    const elapsed = Date.now() - showTimeRef.current;
    const remaining = MIN_DISPLAY_TIME - elapsed;

    if (remaining > 0) {
      hideTimeoutRef.current = setTimeout(clearLoadingState, remaining);
    } else {
      clearLoadingState();
    }
  }, [clearLoadingState]);

  /**
   * ローディング表示付きで非同期処理を実行
   * @param loadingMessage - 表示するメッセージ
   * @param fn - 実行する非同期関数
   * @returns 非同期関数の戻り値
   */
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

  return {
    isLoading,
    message,
    showLoading,
    hideLoading,
    withLoading,
  };
}
