/**
 * トースト通知フック（UI内トースト）
 *
 * react-hot-toastをラップして、アプリケーション固有のトースト表示機能を提供します。
 *
 * @see docs/features/toast-notifications.md
 */

import { createElement } from 'react';
import toast, { ToastOptions } from 'react-hot-toast';
import type { NotificationType } from '@common/types';

import { ToastTypeIcon } from '../components/ToastTypeIcon';

export type ToastType = NotificationType;

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
  // 状態を持たないため常に同一の関数群を返す。
  // 呼び出し側のuseCallback/useMemo依存やリスナー登録が安定する。
  return TOAST_API;
}

/**
 * 種類ごとの見た目（白地のカードに、左の色の帯と色の丸のアイコン）。地の形は ToastProvider が決める
 */
function typeOptions(type: NotificationType, options?: ToastOptions): ToastOptions {
  return {
    icon: createElement(ToastTypeIcon, { type }),
    ...options,
    style: { borderLeftWidth: '4px', borderLeftColor: `var(--notify-${type})`, ...options?.style },
  };
}

const showSuccess = (message: string, options?: ToastOptions) => {
  toast.success(message, typeOptions('success', options));
};

const showError = (message: string, options?: ToastOptions) => {
  toast.error(message, typeOptions('error', options));
};

const showInfo = (message: string, options?: ToastOptions) => {
  toast(message, typeOptions('info', options));
};

const showWarning = (message: string, options?: ToastOptions) => {
  toast(message, typeOptions('warning', options));
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

const TOAST_API: UseToastReturn = {
  showSuccess,
  showError,
  showInfo,
  showWarning,
  showToast,
  dismissAll,
};

// 直接インポートして使用できるようにエクスポート
export { toast };
