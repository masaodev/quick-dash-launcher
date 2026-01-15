/**
 * トースト通知フック
 *
 * react-hot-toastをラップして、アプリケーション固有のトースト表示機能を提供します。
 */

import toast, { ToastOptions } from 'react-hot-toast';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface UseToastReturn {
  /** 成功トーストを表示 */
  showSuccess: (message: string, options?: ToastOptions) => void;
  /** エラートーストを表示 */
  showError: (message: string, options?: ToastOptions) => void;
  /** 情報トーストを表示 */
  showInfo: (message: string, options?: ToastOptions) => void;
  /** 警告トーストを表示 */
  showWarning: (message: string, options?: ToastOptions) => void;
  /** 汎用トースト表示 */
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
  /** すべてのトーストを閉じる */
  dismissAll: () => void;
}

/**
 * トースト通知フック
 *
 * @example
 * ```tsx
 * const { showSuccess, showError } = useToast();
 *
 * // 保存成功時
 * showSuccess('保存しました');
 *
 * // エラー時
 * showError('保存に失敗しました');
 * ```
 */
export function useToast(): UseToastReturn {
  const showSuccess = (message: string, options?: ToastOptions) => {
    toast.success(message, options);
  };

  const showError = (message: string, options?: ToastOptions) => {
    toast.error(message, options);
  };

  const showInfo = (message: string, options?: ToastOptions) => {
    toast(message, {
      icon: 'ℹ️',
      style: {
        background: 'var(--color-info)',
        color: 'var(--color-white)',
      },
      ...options,
    });
  };

  const showWarning = (message: string, options?: ToastOptions) => {
    toast(message, {
      icon: '⚠️',
      style: {
        background: 'var(--color-warning)',
        color: 'var(--text-primary)',
      },
      ...options,
    });
  };

  const showToast = (message: string, type: ToastType = 'info', options?: ToastOptions) => {
    switch (type) {
      case 'success':
        showSuccess(message, options);
        break;
      case 'error':
        showError(message, options);
        break;
      case 'warning':
        showWarning(message, options);
        break;
      case 'info':
      default:
        showInfo(message, options);
        break;
    }
  };

  const dismissAll = () => {
    toast.dismiss();
  };

  return {
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showToast,
    dismissAll,
  };
}

// 直接インポートして使用できるようにエクスポート
export { toast };
