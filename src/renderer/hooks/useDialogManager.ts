import { useState, useCallback, useRef } from 'react';

import type { ConfirmDetail } from '../components/ConfirmDialog';

import { useToast } from './useToast';

export interface AlertDialogState {
  isOpen: boolean;
  message: string;
  type?: 'info' | 'error' | 'warning' | 'success';
}

/** showConfirm に渡す見た目の指定 */
export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /** 本文の下に出す「項目: 今 → 後」の表（何がどう変わるかを見せたいとき） */
  details?: ReadonlyArray<ConfirmDetail>;
}

export interface ConfirmDialogState extends ConfirmOptions {
  isOpen: boolean;
  message: string;
}

/** AlertDialog の表示状態（メッセージ・種類）を持つ */
export function useAlertDialog() {
  const [alertDialog, setAlertDialog] = useState<AlertDialogState>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const showAlert = useCallback((message: string, type: AlertDialogState['type'] = 'info') => {
    setAlertDialog({
      isOpen: true,
      message,
      type,
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertDialog((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return { alertDialog, showAlert, closeAlert };
}

export function useDialogManager() {
  // トーストフック
  const { showSuccess, showError, showInfo, showWarning, showToast, dismissAll } = useToast();

  const { alertDialog, showAlert, closeAlert } = useAlertDialog();

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    message: '',
    danger: false,
  });

  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const showConfirm = useCallback((message: string, options?: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmDialog({
        isOpen: true,
        message,
        title: options?.title,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        danger: options?.danger || false,
        details: options?.details,
      });
    });
  }, []);

  const closeConfirmDialog = useCallback((result: boolean) => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    confirmResolveRef.current?.(result);
    confirmResolveRef.current = null;
  }, []);

  const handleConfirm = useCallback(() => closeConfirmDialog(true), [closeConfirmDialog]);
  const handleCancelConfirm = useCallback(() => closeConfirmDialog(false), [closeConfirmDialog]);

  return {
    alertDialog,
    showAlert,
    closeAlert,
    confirmDialog,
    showConfirm,
    handleConfirm,
    handleCancelConfirm,
    // Toast（軽量フィードバック用）
    toast: {
      success: showSuccess,
      error: showError,
      info: showInfo,
      warning: showWarning,
      show: showToast,
      dismissAll,
    },
  };
}
