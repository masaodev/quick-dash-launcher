import React, { useEffect } from 'react';

import '../styles/components/Modal.css';
import '../styles/components/AlertDialog.css';
import { Button } from './ui';

type AlertType = 'info' | 'error' | 'warning' | 'success';

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: AlertType;
}

const ALERT_CONFIG: Record<AlertType, { icon: string; defaultTitle: string }> = {
  error: { icon: '❌', defaultTitle: 'エラー' },
  warning: { icon: '⚠️', defaultTitle: '警告' },
  success: { icon: '✅', defaultTitle: '成功' },
  info: { icon: 'ℹ️', defaultTitle: 'お知らせ' },
};

function AlertDialog({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
}: AlertDialogProps): React.ReactElement | null {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const config = ALERT_CONFIG[type];

  return (
    <div className="modal-overlay" onClick={onClose} data-testid="alert-dialog-overlay">
      <div
        className={`modal-content alert-dialog alert-${type}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="alert-dialog"
      >
        <div className="alert-header">
          <span className="alert-icon">{config.icon}</span>
          <h2>{title || config.defaultTitle}</h2>
        </div>

        <div className="alert-body">
          <p>{message}</p>
        </div>

        <div className="modal-actions">
          <Button variant="primary" onClick={onClose} data-testid="alert-dialog-ok-button">
            OK
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AlertDialog;
