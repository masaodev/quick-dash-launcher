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

export function useDialogManager() {
  // トーストフック
  const { showSuccess, showError, showInfo, showWarning, showToast, dismissAll } = useToast();

  const [alertDialog, setAlertDialog] = useState<AlertDialogState>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    message: '',
    title: '確認',
    confirmText: 'OK',
    cancelText: 'キャンセル',
    danger: false,
  });

  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const showAlert = useCallback((message: string, type: AlertDialogState['type'] = 'info') => {
    setAlertDialog({
      isOpen: true,
      message,
      type,
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertDialog({
      isOpen: false,
      message: '',
      type: 'info',
    });
  }, []);

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
          title: options?.title || '確認',
          confirmText: options?.confirmText || 'OK',
          cancelText: options?.cancelText || 'キャンセル',
          danger: options?.danger || false,
        });
      });
    },
    []
  );

  const closeConfirmDialog = useCallback((result: boolean) => {
    setConfirmDialog({
      isOpen: false,
      message: '',
      title: '確認',
      confirmText: 'OK',
      cancelText: 'キャンセル',
      danger: false,
    });
    if (confirmResolveRef.current) {
      confirmResolveRef.current(result);
      confirmResolveRef.current = null;
    }
  }, []);

  const handleConfirm = useCallback(() => {
    closeConfirmDialog(true);
  }, [closeConfirmDialog]);

  const handleCancelConfirm = useCallback(() => {
    closeConfirmDialog(false);
  }, [closeConfirmDialog]);

  return {
    // AlertDialog
    alertDialog,
    showAlert,
    closeAlert,
    // ConfirmDialog
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
