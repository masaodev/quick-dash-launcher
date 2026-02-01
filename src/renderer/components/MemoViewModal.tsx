import React, { useEffect, useRef } from 'react';

import { Button } from './ui';
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
  const modalRef = useRef<HTMLDivElement>(null);

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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay memo-view-modal-overlay" onClick={onClose}>
      <div
        className="modal-content memo-view-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
      >
        <div className="memo-view-header">
          <h3>{itemName}</h3>
        </div>
        <div className="memo-view-content">
          <pre className="memo-text">{memo}</pre>
        </div>
        <div className="memo-view-actions">
          <Button variant="cancel" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MemoViewModal;
