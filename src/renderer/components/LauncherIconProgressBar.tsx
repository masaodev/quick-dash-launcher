import React, { useState } from 'react';
import { IconProgress } from '@common/types';

import IconProgressDetailModal from './IconProgressDetailModal';
import { Button } from './ui/Button';
import '../styles/components/LauncherIconProgress.css';

interface IconProgressBarProps {
  progress: IconProgress;
  onClose: () => void;
}

const LauncherIconProgressBar: React.FC<IconProgressBarProps> = ({ progress, onClose }) => {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const formatElapsedTime = (startTime: number, completedTime?: number): string => {
    const endTime = completedTime ?? Date.now();
    const elapsed = Math.floor((endTime - startTime) / 1000);
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

  const getPhaseDisplayName = (type: string): string => {
    switch (type) {
      case 'favicon':
        return 'ファビコン取得';
      case 'icon':
        return 'アイコン抽出';
      default:
        return '処理';
    }
  };

  // 現在のフェーズを取得
  const currentPhase = progress.phases[progress.currentPhase - 1];

  // 全体の進捗率を計算
  const totalItems = progress.phases.reduce((sum, phase) => sum + phase.total, 0);
  const completedItems = progress.phases.reduce((sum, phase) => sum + phase.current, 0);
  const overallPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  // 全体の成功数とエラー数を計算
  const totalSuccess = progress.phases.reduce(
    (sum, phase) => sum + (phase.current - phase.errors),
    0
  );
  const totalErrors = progress.phases.reduce((sum, phase) => sum + phase.errors, 0);

  // 全結果を統合
  const allResults = progress.phases.flatMap((phase) => phase.results || []);

  return (
    <>
      <div className="icon-progress-bar">
        <div className="progress-header">
          <div className="progress-info">
            <span className="progress-type">
              {progress.isComplete
                ? 'アイコン取得完了'
                : `フェーズ ${progress.currentPhase}/${progress.totalPhases}: ${getPhaseDisplayName(currentPhase?.type || '')}`}
            </span>
            <div className="progress-counts">
              <span className="success-count">成功: {totalSuccess}件</span>
              {totalErrors > 0 && <span className="error-count">エラー: {totalErrors}件</span>}
              <span className="total-count">全体: {totalItems}件</span>
            </div>
          </div>
          <div className="progress-stats">
            <span className="elapsed-time">
              経過: {formatElapsedTime(progress.startTime, progress.completedTime)}
            </span>
            {currentPhase && currentPhase.current > 0 && !progress.isComplete && (
              <span className="estimated-time">
                残り:{' '}
                {formatEstimatedTime(
                  currentPhase.startTime,
                  currentPhase.current,
                  currentPhase.total
                )}
              </span>
            )}
          </div>
          <div className="progress-actions">
            {progress.isComplete && allResults.length > 0 && (
              <Button
                variant="info"
                size="sm"
                onClick={() => setIsDetailModalOpen(true)}
                aria-label="詳細を表示"
              >
                詳細
              </Button>
            )}
            <button className="progress-close-btn" onClick={onClose} aria-label="閉じる">
              ×
            </button>
          </div>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${overallPercentage}%` }} />
          </div>
          <div className="progress-percentage">{Math.round(overallPercentage)}%</div>
        </div>

        {currentPhase && currentPhase.currentItem && !progress.isComplete && (
          <div className="current-item">
            処理中:{' '}
            {currentPhase.currentItem.split('\n').map((line, i) => (
              <React.Fragment key={i}>
                {line.length > 80 ? line.substring(0, 80) + '...' : line}
                {i < currentPhase.currentItem.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      <IconProgressDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        results={allResults}
      />
    </>
  );
};

export default LauncherIconProgressBar;
