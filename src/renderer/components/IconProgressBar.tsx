import React from 'react';
import { IconProgress } from '../../common/types';

interface IconProgressBarProps {
  progress: IconProgress;
}

const IconProgressBar: React.FC<IconProgressBarProps> = ({ progress }) => {
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

  const getTypeDisplayName = (type: string): string => {
    switch (type) {
      case 'favicon':
        return 'ファビコン取得中';
      case 'icon':
        return 'アイコン抽出中';
      default:
        return '処理中';
    }
  };

  const truncateItemName = (itemName: string, maxLength = 30): string => {
    if (itemName.length <= maxLength) return itemName;
    return itemName.substring(0, maxLength) + '...';
  };

  return (
    <div className="icon-progress-bar">
      <div className="progress-header">
        <div className="progress-info">
          <span className="progress-type">{getTypeDisplayName(progress.type)}</span>
          <span className="progress-count">
            {progress.current}/{progress.total}
          </span>
        </div>
        <div className="progress-stats">
          {progress.errors > 0 && (
            <span className="error-count">エラー: {progress.errors}件</span>
          )}
          <span className="elapsed-time">経過: {formatElapsedTime(progress.startTime)}</span>
          {progress.current > 0 && !progress.isComplete && (
            <span className="estimated-time">
              残り: {formatEstimatedTime(progress.startTime, progress.current, progress.total)}
            </span>
          )}
        </div>
      </div>
      
      <div className="progress-bar-container">
        <div className="progress-bar-track">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="progress-percentage">
          {Math.round(progressPercentage)}%
        </div>
      </div>
      
      {progress.currentItem && !progress.isComplete && (
        <div className="current-item">
          処理中: {truncateItemName(progress.currentItem)}
        </div>
      )}
      
      {progress.isComplete && (
        <div className="completion-message">
          {progress.type === 'favicon' ? 'ファビコン取得完了' : 'アイコン抽出完了'}
          {progress.errors > 0 && ` (${progress.errors}件のエラー)`}
        </div>
      )}
    </div>
  );
};

export default IconProgressBar;