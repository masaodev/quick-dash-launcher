import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconProgress } from '@common/types';

import { Button } from './ui/Button';
import '../styles/components/LauncherIconProgress.css';

interface IconProgressBarProps {
  progress: IconProgress;
  onClose: () => void;
}

const PHASE_NAME_KEYS = {
  favicon: 'launcher.iconProgress.phaseNames.favicon',
  icon: 'launcher.iconProgress.phaseNames.icon',
} as const;

const LauncherIconProgressBar: React.FC<IconProgressBarProps> = ({ progress, onClose }) => {
  const { t } = useTranslation();

  const formatElapsedTime = (startTime: number, completedTime?: number): string => {
    const endTime = completedTime ?? Date.now();
    const elapsed = Math.floor((endTime - startTime) / 1000);
    return t('launcher.iconProgress.seconds', { seconds: elapsed });
  };

  const formatEstimatedTime = (startTime: number, current: number, total: number): string => {
    if (current === 0) return t('launcher.iconProgress.calculating');

    const elapsed = Date.now() - startTime;
    const avgTimePerItem = elapsed / current;
    const remaining = total - current;
    const estimatedMs = avgTimePerItem * remaining;
    const estimatedSeconds = Math.ceil(estimatedMs / 1000);

    if (estimatedSeconds < 60) {
      return t('launcher.iconProgress.aboutSeconds', { seconds: estimatedSeconds });
    } else {
      const minutes = Math.floor(estimatedSeconds / 60);
      const seconds = estimatedSeconds % 60;
      return t('launcher.iconProgress.aboutMinutes', { minutes, seconds });
    }
  };

  const getPhaseDisplayName = (type: string): string => {
    const key = PHASE_NAME_KEYS[type as keyof typeof PHASE_NAME_KEYS];
    return key ? t(key) : t('launcher.iconProgress.phaseNames.other');
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

  // 詳細は独立した子ウィンドウで開く（メインウィンドウを広げない）
  const openDetail = () => {
    void window.electronAPI.openMainChildWindow({
      kind: 'iconProgressDetail',
      results: allResults,
    });
  };

  return (
    <>
      <div className="icon-progress-bar">
        <div className="progress-header">
          <div className="progress-info">
            <span className="progress-type">
              {progress.isComplete
                ? t('launcher.iconProgress.complete')
                : t('launcher.iconProgress.phase', {
                    current: progress.currentPhase,
                    total: progress.totalPhases,
                    name: getPhaseDisplayName(currentPhase?.type || ''),
                  })}
            </span>
            <div className="progress-counts">
              <span className="success-count">
                {t('launcher.iconProgress.succeeded', { count: totalSuccess })}
              </span>
              {totalErrors > 0 && (
                <span className="error-count">
                  {t('launcher.iconProgress.failed', { count: totalErrors })}
                </span>
              )}
              <span className="total-count">
                {t('launcher.iconProgress.total', { count: totalItems })}
              </span>
            </div>
          </div>
          <div className="progress-stats">
            <span className="elapsed-time">
              {t('launcher.iconProgress.elapsed', {
                time: formatElapsedTime(progress.startTime, progress.completedTime),
              })}
            </span>
            {currentPhase && currentPhase.current > 0 && !progress.isComplete && (
              <span className="estimated-time">
                {t('launcher.iconProgress.remaining', {
                  time: formatEstimatedTime(
                    currentPhase.startTime,
                    currentPhase.current,
                    currentPhase.total
                  ),
                })}
              </span>
            )}
          </div>
          <div className="progress-actions">
            {progress.isComplete && allResults.length > 0 && (
              <Button
                variant="info"
                size="sm"
                onClick={openDetail}
                aria-label={t('common.showDetails')}
              >
                {t('common.details')}
              </Button>
            )}
            <button className="progress-close-btn" onClick={onClose} aria-label={t('common.close')}>
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
            {t('launcher.iconProgress.processing')}{' '}
            {currentPhase.currentItem.split('\n').map((line, i) => (
              <React.Fragment key={i}>
                {line.length > 80 ? line.substring(0, 80) + '...' : line}
                {i < currentPhase.currentItem.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default LauncherIconProgressBar;
