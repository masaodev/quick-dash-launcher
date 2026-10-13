/**
 * 画面: 共通ダイアログ（ファイル選択）
 * 画面仕様: docs/screens/dialogs.md#4-filepickerdialog
 */
import { useTranslation } from 'react-i18next';
import React, { useEffect } from 'react';

import '../styles/components/Modal.css';
import '../styles/components/FilePickerDialog.css';
import { logError } from '../utils/debug';

import { Button } from './ui';

interface FilePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (filePath: string) => void;
  title?: string;
  /** 選べるファイルの種類（呼び出し元が必ず指定する） */
  fileTypes: 'html' | 'image';
  description?: string;
}

const FilePickerDialog: React.FC<FilePickerDialogProps> = ({
  isOpen,
  onClose,
  onFileSelect,
  title,
  fileTypes,
  description,
}) => {
  const { t } = useTranslation();
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleBrowseClick = async () => {
    try {
      let filePath: string | null = null;

      // ファイルタイプに応じて適切なElectron APIを呼び出す
      if (fileTypes === 'html') {
        filePath = await window.electronAPI.selectBookmarkFile();
      } else if (fileTypes === 'image') {
        filePath = await window.electronAPI.selectCustomIconFile();
      }

      if (filePath) {
        onFileSelect(filePath);
        onClose();
      }
    } catch (error) {
      logError('ファイル選択エラー:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} data-testid="file-picker-dialog-overlay">
      <div
        className="modal-content file-picker-dialog"
        onClick={(e) => e.stopPropagation()}
        data-testid="file-picker-dialog"
      >
        <div className="file-picker-header">
          <h2>{title ?? t('filePicker.title')}</h2>
        </div>

        <div className="file-picker-body">
          {description && <p className="file-picker-description">{description}</p>}
          <button
            className="browse-button"
            onClick={handleBrowseClick}
            data-testid="file-picker-browse-button"
          >
            {t('filePicker.browse')}
          </button>
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose} data-testid="file-picker-cancel-button">
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FilePickerDialog;
