import React, { useEffect } from 'react';

import '../styles/components/Modal.css';
import '../styles/components/AlertDialog.css';

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'info' | 'error' | 'warning' | 'success';
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    window.addEventListener('keydown', handleEnter);

    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('keydown', handleEnter);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      default:
        return 'ℹ️';
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'error':
        return 'エラー';
      case 'warning':
        return '警告';
      case 'success':
        return '成功';
      default:
        return 'お知らせ';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} data-testid="alert-dialog-overlay">
      <div
        className={`modal-content alert-dialog alert-${type}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="alert-dialog"
      >
        <div className="alert-header">
          <span className="alert-icon">{getIcon()}</span>
          <h2>{title || getDefaultTitle()}</h2>
        </div>

        <div className="alert-body">
          <p>{message}</p>
        </div>

        <div className="modal-actions">
          <button className="primary" onClick={onClose} data-testid="alert-dialog-ok-button">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDialog;
