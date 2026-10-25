/**
 * トースト通知フック（UI内トースト）
 *
 * react-hot-toastをラップして、アプリケーション固有のトースト表示機能を提供します。
 *
 * @see docs/features/toast-notifications.md
 */

import { createElement } from 'react';
import toast from 'react-hot-toast';
import type { NotificationType } from '@common/types';
import { toastDurationMs } from '@common/constants';

import { ToastTypeIcon } from '../components/ToastTypeIcon';

export type ToastType = NotificationType;

/** トーストの出し方の指定（表示時間は数値で指定せず、種類と long で決める） */
export interface ShowToastOptions {
  /** 長めに出す（2 行以上・件数や名前の並び）。src/common/constants.ts の toastDurationMs */
  long?: boolean;
  /** 同じ ID のトーストは重ねずに置き換える */
  id?: string;
}

interface UseToastReturn {
  /** 成功トーストを表示 */
  showSuccess: (message: string, options?: ShowToastOptions) => void;
  /** エラートーストを表示 */
  showError: (message: string, options?: ShowToastOptions) => void;
  /** 情報トーストを表示 */
  showInfo: (message: string, options?: ShowToastOptions) => void;
  /** 警告トーストを表示 */
  showWarning: (message: string, options?: ShowToastOptions) => void;
  /** 汎用トースト表示 */
  showToast: (message: string, type: ToastType, options?: ShowToastOptions) => void;
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
function typeOptions(type: NotificationType, options?: ShowToastOptions) {
  return {
    id: options?.id,
    duration: toastDurationMs(type, options?.long),
    icon: createElement(ToastTypeIcon, { type }),
    style: { borderLeftWidth: '4px', borderLeftColor: `var(--notify-${type})` },
  };
}

const showSuccess = (message: string, options?: ShowToastOptions) => {
  toast.success(message, typeOptions('success', options));
};

const showError = (message: string, options?: ShowToastOptions) => {
  toast.error(message, typeOptions('error', options));
};

const showInfo = (message: string, options?: ShowToastOptions) => {
  toast(message, typeOptions('info', options));
};

const showWarning = (message: string, options?: ShowToastOptions) => {
  toast(message, typeOptions('warning', options));
};

const showToast = (message: string, type: ToastType, options?: ShowToastOptions) => {
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
