import React, { useState } from 'react';

import { IconProgress } from '../../common/types';

import IconProgressDetailModal from './IconProgressDetailModal';
import '../styles/components/IconProgress.css';

interface IconProgressBarProps {
  progress: IconProgress;
  onClose: () => void;
}

const IconProgressBar: React.FC<IconProgressBarProps> = ({ progress, onClose }) => {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  const formatElapsedTime = (startTime: number): string => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    return `${elapsed}秒`;
  };

  const formatEstimatedTime = (startTime: number, current: number, total: number): string => {
    if (current === 0) return '計算中...';

    const elapsed = Date.now() - startTime;
    const avgTimePerItem = elapsed / current;
    const remaining = total - current;
    const estimatedMs = avgTimePerItem * remaining;
    const estimatedSeconds = Math.ceil(estimatedMs / 1000);

    if (estimatedSeconds < 60) {
      return `約${estimatedSeconds}秒`;
    } else {
      const minutes = Math.floor(estimatedSeconds / 60);
      const seconds = estimatedSeconds % 60;
      return `約${minutes}分${seconds}秒`;
    }
  };

  const getTypeDisplayName = (type: string, isComplete: boolean): string => {
    if (isComplete) {
      switch (type) {
        case 'favicon':
          return 'ファビコン取得完了';
        case 'icon':
          return 'アイコン抽出完了';
        default:
          return '処理完了';
      }
    } else {
      switch (type) {
        case 'favicon':
          return 'ファビコン取得中';
        case 'icon':
          return 'アイコン抽出中';
        default:
          return '処理中';
      }
    }
  };

  const truncateItemName = (itemName: string, maxLength = 30): string => {
    if (itemName.length <= maxLength) return itemName;
    return itemName.substring(0, maxLength) + '...';
  };

  const successCount = progress.current - progress.errors;

  return (
    <>
      <div className="icon-progress-bar">
        <div className="progress-header">
          <div className="progress-info">
            <span className="progress-type">
              {getTypeDisplayName(progress.type, progress.isComplete)}
            </span>
            <div className="progress-counts">
              <span className="success-count">成功: {successCount}件</span>
              {progress.errors > 0 && (
                <span className="error-count">エラー: {progress.errors}件</span>
              )}
              <span className="total-count">全体: {progress.total}件</span>
            </div>
          </div>
          <div className="progress-stats">
            <span className="elapsed-time">経過: {formatElapsedTime(progress.startTime)}</span>
            {progress.current > 0 && !progress.isComplete && (
              <span className="estimated-time">
                残り: {formatEstimatedTime(progress.startTime, progress.current, progress.total)}
              </span>
            )}
          </div>
          <div className="progress-actions">
            {progress.isComplete && progress.results && progress.results.length > 0 && (
              <button
                className="progress-detail-btn"
                onClick={() => setIsDetailModalOpen(true)}
                aria-label="詳細を表示"
              >
                詳細
              </button>
            )}
            <button className="progress-close-btn" onClick={onClose} aria-label="閉じる">
              ×
            </button>
          </div>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }} />
          </div>
          <div className="progress-percentage">{Math.round(progressPercentage)}%</div>
        </div>

        {progress.currentItem && !progress.isComplete && (
          <div className="current-item">処理中: {truncateItemName(progress.currentItem)}</div>
        )}
      </div>

      <IconProgressDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        type={progress.type}
        results={progress.results || []}
      />
    </>
  );
};

export default IconProgressBar;
