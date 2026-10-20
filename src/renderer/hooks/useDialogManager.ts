import { useState, useCallback, useRef } from 'react';

import { useToast } from './useToast';

export interface AlertDialogState {
  isOpen: boolean;
  message: string;
  type?: 'info' | 'error' | 'warning' | 'success';
}

export interface ConfirmDialogState {
  isOpen: boolean;
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
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

  const showConfirm = useCallback(
    (
      message: string,
      options?: {
        title?: string;
        confirmText?: string;
        cancelText?: string;
        danger?: boolean;
      }
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        confirmResolveRef.current = resolve;
        setConfirmDialog({
          isOpen: true,
          message,
          title: options?.title,
          confirmText: options?.confirmText,
          cancelText: options?.cancelText,
          danger: options?.danger || false,
        });
      });
    },
    []
  );

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
