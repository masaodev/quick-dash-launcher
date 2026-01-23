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
  fileTypes?: 'html' | 'image' | 'all'; // ファイルタイプフィルター
  description?: string;
}

const FilePickerDialog: React.FC<FilePickerDialogProps> = ({
  isOpen,
  onClose,
  onFileSelect,
  title = 'ファイルを選択',
  fileTypes = 'all',
  description,
}) => {
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
          <h2>{title}</h2>
        </div>

        <div className="file-picker-body">
          {description && <p className="file-picker-description">{description}</p>}
          <button
            className="browse-button"
            onClick={handleBrowseClick}
            data-testid="file-picker-browse-button"
          >
            ファイルを参照...
          </button>
        </div>

        <div className="modal-actions">
          <Button variant="cancel" onClick={onClose} data-testid="file-picker-cancel-button">
            キャンセル
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FilePickerDialog;
