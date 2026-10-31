/**
 * 画面: 共通ダイアログ（確認）
 * 画面仕様: docs/screens/dialogs.md#3-confirmdialog
 */
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import '../styles/components/Modal.css';
import '../styles/components/ConfirmDialog.css';
import { Button } from './ui';

/** 確認ダイアログの表の 1 行（項目名と、変わる前・後の値） */
export interface ConfirmDetail {
  label: string;
  before: string;
  after: string;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /** 本文の下に赤字で出す注意 */
  warning?: string;
  /** 本文の下に出す「項目: 今 → 後」の表 */
  details?: ReadonlyArray<ConfirmDetail>;
  showCheckbox?: boolean;
  checkboxLabel?: string;
  checkboxChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
  /** 独立した確認ウィンドウの中身として描く（オーバーレイなしでウィンドウいっぱいに広げる） */
  asPage?: boolean;
}

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  danger = false,
  warning,
  details,
  showCheckbox = false,
  checkboxLabel = '',
  checkboxChecked = false,
  onCheckboxChange,
  asPage = false,
}: ConfirmDialogProps): React.ReactElement | null {
  const { t } = useTranslation();

  // Enter・Esc は AlertDialog と同じく capture 段階で受けて止める。後ろの画面のキー処理
  //（ランチャーで Enter がアイテムを実行する・Esc が画面を閉じるなど）に漏らさない
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Escape' && e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        onClose();
      } else {
        onConfirm();
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      className={asPage ? 'confirm-window-page' : 'modal-overlay'}
      onClick={asPage ? undefined : onClose}
      data-testid="confirm-dialog-overlay"
    >
      <div
        className={`modal-content confirm-dialog${danger ? ' confirm-danger' : ''}${asPage ? ' confirm-window-content' : ''}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="confirm-dialog"
      >
        <div className="confirm-header">
          <h2>{title || t('common.confirm')}</h2>
        </div>

        <div className="confirm-body">
          <p>{message}</p>
          {details && details.length > 0 && (
            <table className="confirm-details" data-testid="confirm-dialog-details">
              <tbody>
                {details.map((detail) => (
                  <tr key={detail.label}>
                    <th scope="row">{detail.label}</th>
                    <td>
                      {detail.before}
                      <span className="confirm-details-arrow" aria-hidden="true">
                        →
                      </span>
                      {detail.after}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {warning && (
            <p className="confirm-warning" data-testid="confirm-dialog-warning">
              {warning}
            </p>
          )}
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
          <Button variant="secondary" onClick={onClose} data-testid="confirm-dialog-cancel-button">
            {cancelText || t('common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger-solid' : 'primary'}
            onClick={onConfirm}
            data-testid="confirm-dialog-confirm-button"
          >
            {confirmText || t('common.ok')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
