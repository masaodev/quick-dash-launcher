import React, { useState, useRef } from 'react';
import { IconProgressResult } from '@common/types';

import '../styles/components/IconProgressDetailModal.css';
import { useModalKeyboard } from '../hooks/useModalKeyboard';

import { Button } from './ui';

interface IconProgressDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: IconProgressResult[];
  /** 独立した子ウィンドウの中身として描く（オーバーレイなしでウィンドウいっぱいに広げる） */
  asPage?: boolean;
}

const IconProgressDetailModal: React.FC<IconProgressDetailModalProps> = ({
  isOpen,
  onClose,
  results,
  asPage = false,
}) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const modalRef = useRef<HTMLDivElement>(null);

  useModalKeyboard({ isOpen, modalRef, onClose });

  if (!isOpen) return null;

  const successResults = results.filter((r) => r.success);
  const errorResults = results.filter((r) => !r.success);

  const filterMap = { all: results, success: successResults, error: errorResults };
  const filteredResults = filterMap[filter];

  return (
    <div
      className={asPage ? 'main-child-page' : 'modal-overlay'}
      onClick={asPage ? undefined : onClose}
    >
      <div
        className={`modal-content icon-detail-modal${asPage ? ' main-child-content' : ''}`}
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
