import React, { useState, useEffect, useRef } from 'react';
import { IconProgressResult } from '@common/types';

import '../styles/components/IconProgressDetailModal.css';
import { Button } from './ui';

interface IconProgressDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: IconProgressResult[];
}

const IconProgressDetailModal: React.FC<IconProgressDetailModalProps> = ({
  isOpen,
  onClose,
  results,
}) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // モーダル表示時にウィンドウサイズを拡大
      window.electronAPI.setModalMode(true, { width: 800, height: 700 });
    }

    return () => {
      // モーダルを閉じた時にウィンドウサイズを元に戻す
      if (isOpen) {
        window.electronAPI.setModalMode(false);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    modalRef.current?.focus();

    const stopEvent = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const modal = modalRef.current;
      if (!modal) return;

      if (event.key === 'Escape') {
        stopEvent(event);
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey && document.activeElement === firstElement) {
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          firstElement.focus();
        }
        stopEvent(event);
        return;
      }

      if (modal.contains(document.activeElement)) {
        stopEvent(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const successResults = results.filter((r) => r.success);
  const errorResults = results.filter((r) => !r.success);

  const filterMap = { all: results, success: successResults, error: errorResults };
  const filteredResults = filterMap[filter];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content icon-detail-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2>アイコン取得結果</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>

        <div className="modal-summary">
          <div className="summary-item success">
            <span className="summary-label">成功:</span>
            <span className="summary-value">{successResults.length}件</span>
          </div>
          <div className="summary-item error">
            <span className="summary-label">エラー:</span>
            <span className="summary-value">{errorResults.length}件</span>
          </div>
          <div className="summary-item total">
            <span className="summary-label">全体:</span>
            <span className="summary-value">{results.length}件</span>
          </div>
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            すべて ({results.length})
          </button>
          <button
            className={`filter-btn ${filter === 'success' ? 'active' : ''}`}
            onClick={() => setFilter('success')}
          >
            成功 ({successResults.length})
          </button>
          <button
            className={`filter-btn ${filter === 'error' ? 'active' : ''}`}
            onClick={() => setFilter('error')}
          >
            エラー ({errorResults.length})
          </button>
        </div>

        <div className="results-list">
          {filteredResults.length === 0 ? (
            <div className="no-results">結果がありません</div>
          ) : (
            filteredResults.map((result, index) => (
              <div key={index} className={`result-item ${result.success ? 'success' : 'error'}`}>
                <div className="result-icon">{result.success ? '✓' : '✗'}</div>
                <div className="result-content">
                  <div className="result-name">
                    {result.itemName.split('\n').map((line, i, lines) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < lines.length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                  {result.errorMessage && <div className="result-error">{result.errorMessage}</div>}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="modal-actions">
          <Button variant="primary" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IconProgressDetailModal;
