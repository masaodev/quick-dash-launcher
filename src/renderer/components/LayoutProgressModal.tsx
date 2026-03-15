import React, { useEffect, useRef } from 'react';
import type { LayoutExecutionProgress, LayoutEntryStatus } from '@common/types';

import { Button } from './ui';

import '../styles/components/LayoutProgressModal.css';

interface LayoutProgressModalProps {
  isOpen: boolean;
  progress: LayoutExecutionProgress | null;
  onClose: () => void;
  onCancel: () => void;
}

const LayoutProgressModal: React.FC<LayoutProgressModalProps> = ({
  isOpen,
  progress,
  onClose,
  onCancel,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    modalRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (progress?.isComplete) {
          onClose();
        } else {
          onCancel();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, progress?.isComplete, onClose, onCancel]);

  if (!isOpen || !progress) return null;

  const successCount = progress.entries.filter((e) => e.status === 'success').length;
  const failedCount = progress.entries.filter((e) => e.status === 'failed').length;
  const completedCount = successCount + failedCount;
  const totalCount = progress.entries.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const statusIcon = (status: LayoutEntryStatus) => {
    switch (status) {
      case 'waiting':
        return <span className="layout-status-icon waiting">○</span>;
      case 'launching':
        return <span className="layout-status-icon launching">⟳</span>;
      case 'success':
        return <span className="layout-status-icon success">✓</span>;
      case 'failed':
        return <span className="layout-status-icon failed">✗</span>;
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div
        className="modal-content layout-progress-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2>{progress.layoutName}</h2>
        </div>

        <div className="layout-progress-bar-container">
          <div className="layout-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          <span className="layout-progress-bar-text">
            {completedCount} / {totalCount}
          </span>
        </div>

        <div className="layout-entry-list">
          {progress.entries.map((entry) => (
            <div key={entry.index} className={`layout-entry-item ${entry.status}`}>
              {statusIcon(entry.status)}
              <div className="layout-entry-content">
                <span className="layout-entry-title">{entry.windowTitle}</span>
                {entry.errorMessage && (
                  <span className="layout-entry-error">{entry.errorMessage}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          {progress.isComplete ? (
            <Button variant="primary" onClick={onClose}>
              閉じる
            </Button>
          ) : (
            <Button variant="danger" onClick={onCancel}>
              キャンセル
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LayoutProgressModal;
