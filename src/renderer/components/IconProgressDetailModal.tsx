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

  // キーイベント処理
  useEffect(() => {
    if (!isOpen) return;

    // フォーカスをモーダルに設定
    modalRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      const modal = modalRef.current;
      if (!modal) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusableElement = focusableElements[0] as HTMLElement;
        const lastFocusableElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey) {
          // Shift+Tab: 逆方向
          if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        } else {
          // Tab: 順方向
          if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
          }
        }
        // モーダル内でのTab操作なので、すべての場合で背景への伝播を阻止
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return;
      }

      // モーダル内でのキーイベントの場合、背景への伝播を完全に阻止
      const isModalFocused = modal.contains(document.activeElement);
      if (isModalFocused) {
        // このモーダルは読み取り専用なので、すべてのキーを阻止（ただしフィルターボタンはクリック可能）
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const successResults = results.filter((r) => r.success);
  const errorResults = results.filter((r) => !r.success);

  const filteredResults =
    filter === 'all' ? results : filter === 'success' ? successResults : errorResults;

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
                    {result.itemName.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < result.itemName.split('\n').length - 1 && <br />}
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
