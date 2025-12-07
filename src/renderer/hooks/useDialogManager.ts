import { useState, useCallback } from 'react';

export interface AlertDialogState {
  isOpen: boolean;
  message: string;
  type?: 'info' | 'error' | 'warning' | 'success';
}

export function useDialogManager() {
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
    setAlertDialog({
      isOpen: false,
      message: '',
      type: 'info',
    });
  }, []);

  return {
    alertDialog,
    showAlert,
    closeAlert,
  };
}
