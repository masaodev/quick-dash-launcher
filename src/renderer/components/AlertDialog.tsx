/**
 * 画面: 共通ダイアログ（アラート）
 * 画面仕様: docs/screens/dialogs.md#2-alertdialog
 */
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { NotificationType } from '@common/types';

import '../styles/components/Modal.css';
import '../styles/components/AlertDialog.css';
import { Button } from './ui';
import { ToastTypeIcon } from './ToastTypeIcon';

type AlertType = NotificationType;

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: AlertType;
}

function AlertDialog({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
}: AlertDialogProps): React.ReactElement | null {
  const { t } = useTranslation();
  // Enter・Esc は capture 段階で受けて止める。後ろの画面のキー処理（ランチャーで Enter がアイテムを
  // 実行するなど）に先に取られると、ダイアログが閉じずに後ろの操作が走る
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} data-testid="alert-dialog-overlay">
      <div
        className={`modal-content alert-dialog alert-${type}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="alert-dialog"
      >
        <div className="alert-header">
          <ToastTypeIcon type={type} size="large" />
          <h2>{title || t(`common.alertTitle.${type}`)}</h2>
        </div>

        <div className="alert-body">
          <p>{message}</p>
        </div>

        <div className="modal-actions">
          <Button variant="primary" onClick={onClose} data-testid="alert-dialog-ok-button">
            {t('common.ok')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AlertDialog;
