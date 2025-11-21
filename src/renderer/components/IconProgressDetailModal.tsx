import React, { useState, useEffect } from 'react';

import { IconProgressResult } from '../../common/types';
import '../styles/components/IconProgressDetailModal.css';

interface IconProgressDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'favicon' | 'icon';
  results: IconProgressResult[];
}

const IconProgressDetailModal: React.FC<IconProgressDetailModalProps> = ({
  isOpen,
  onClose,
  type,
  results,
}) => {
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');

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

  if (!isOpen) return null;

  const successResults = results.filter((r) => r.success);
  const errorResults = results.filter((r) => !r.success);

  const filteredResults =
    filter === 'all' ? results : filter === 'success' ? successResults : errorResults;

  const getTypeDisplayName = (): string => {
    return type === 'favicon' ? 'ファビコン取得' : 'アイコン抽出';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content icon-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{getTypeDisplayName()}結果</h2>
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
                  <div className="result-name">{result.itemName}</div>
                  {result.errorMessage && <div className="result-error">{result.errorMessage}</div>}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="primary">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default IconProgressDetailModal;
