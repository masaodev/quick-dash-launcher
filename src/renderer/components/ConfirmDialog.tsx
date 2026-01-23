import React, { useEffect } from 'react';

import '../styles/components/Modal.css';
import '../styles/components/ConfirmDialog.css';
import { Button } from './ui';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  showCheckbox?: boolean;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = '確認',
  message,
  confirmText = 'OK',
  cancelText = 'キャンセル',
  danger = false,
  showCheckbox = false,
  checkboxLabel = '',
  checkboxChecked = false,
  onCheckboxChange,
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
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleEscape);
    window.addEventListener('keydown', handleEnter);

    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('keydown', handleEnter);
    };
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} data-testid="confirm-dialog-overlay">
      <div
        className={`modal-content confirm-dialog ${danger ? 'confirm-danger' : ''}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="confirm-dialog"
      >
        <div className="confirm-header">
          <h2>{title}</h2>
        </div>

        <div className="confirm-body">
          <p>{message}</p>
          {showCheckbox && (
            <div className="confirm-checkbox-container">
              <label className="confirm-checkbox-label">
                <input
                  type="checkbox"
                  checked={checkboxChecked}
                  onChange={(e) => onCheckboxChange?.(e.target.checked)}
                  data-testid="confirm-dialog-checkbox"
                />
                <span>{checkboxLabel}</span>
              </label>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <Button variant="cancel" onClick={onClose} data-testid="confirm-dialog-cancel-button">
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            data-testid="confirm-dialog-confirm-button"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
