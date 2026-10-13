/**
 * 画面: アイコン取得結果
 * 画面仕様: docs/screens/icon-progress-detail-modal.md
 */
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          <h2>{t('launcher.iconResults.title')}</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>

        <div className="modal-summary">
          <div className="summary-item success">
            <span className="summary-label">{t('launcher.iconResults.succeeded')}</span>
            <span className="summary-value">
              {t('common.itemCount', { count: successResults.length })}
            </span>
          </div>
          <div className="summary-item error">
            <span className="summary-label">{t('launcher.iconResults.failed')}</span>
            <span className="summary-value">
              {t('common.itemCount', { count: errorResults.length })}
            </span>
          </div>
          <div className="summary-item total">
            <span className="summary-label">{t('launcher.iconResults.total')}</span>
            <span className="summary-value">
              {t('common.itemCount', { count: results.length })}
            </span>
          </div>
        </div>

        <div className="filter-buttons">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            {t('launcher.iconResults.filterAll', { count: results.length })}
          </button>
          <button
            className={`filter-btn ${filter === 'success' ? 'active' : ''}`}
            onClick={() => setFilter('success')}
          >
            {t('launcher.iconResults.filterSucceeded', { count: successResults.length })}
          </button>
          <button
            className={`filter-btn ${filter === 'error' ? 'active' : ''}`}
            onClick={() => setFilter('error')}
          >
            {t('launcher.iconResults.filterFailed', { count: errorResults.length })}
          </button>
        </div>

        <div className="results-list">
          {filteredResults.length === 0 ? (
            <div className="no-results">{t('launcher.iconResults.empty')}</div>
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
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IconProgressDetailModal;
