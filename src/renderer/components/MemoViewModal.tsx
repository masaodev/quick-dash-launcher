import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { logError } from '../utils/debug';

import { Button } from './ui';
import '../styles/components/Modal.css';
import '../styles/components/MemoViewModal.css';

interface MemoViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  memo: string;
}

/**
 * メモ表示用モーダル
 * アイテムのメモ内容を閲覧するためのシンプルなモーダル
 */
const MemoViewModal: React.FC<MemoViewModalProps> = ({ isOpen, onClose, itemName, memo }) => {
  const { t } = useTranslation();
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(memo);
    } catch (error) {
      logError('クリップボードへのコピーに失敗しました:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content memo-view-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{itemName}</h2>
        </div>
        <div className="memo-view-content">
          <pre className="memo-text">{memo}</pre>
        </div>
        <div className="modal-actions">
          <Button onClick={handleCopyToClipboard}>{t('common.copy')}</Button>
          <Button variant="cancel" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MemoViewModal;
