import { useState, useEffect } from 'react';

import { IconProgress, IconProgressState } from '../../common/types';

export const useIconProgress = () => {
  const [progressState, setProgressState] = useState<IconProgressState>({
    isActive: false,
    progress: null,
  });

  useEffect(() => {
    // IPCイベントリスナーを設定
    const handleProgressStart = (data: Omit<IconProgress, 'current' | 'isComplete'>) => {
      setProgressState({
        isActive: true,
        progress: {
          ...data,
          current: 0,
          isComplete: false,
        },
      });
    };

    const handleProgressUpdate = (data: IconProgress) => {
      setProgressState((_prevState) => ({
        isActive: true,
        progress: data,
      }));
    };

    const handleProgressComplete = (data: IconProgress) => {
      setProgressState({
        isActive: true,
        progress: {
          ...data,
          isComplete: true,
        },
      });

      // 完了後3秒で自動的に非表示にする
      setTimeout(() => {
        setProgressState({
          isActive: false,
          progress: null,
        });
      }, 3000);
    };

    // IPCイベントリスナーを登録
    if (window.electronAPI && window.electronAPI.onIconProgress) {
      window.electronAPI.onIconProgress('start', handleProgressStart);
      window.electronAPI.onIconProgress('update', handleProgressUpdate);
      window.electronAPI.onIconProgress('complete', handleProgressComplete);
    }

    // クリーンアップ関数
    return () => {
      // 必要に応じてリスナーを削除
      // この実装では特別なクリーンアップは不要
    };
  }, []);

  const resetProgress = () => {
    setProgressState({
      isActive: false,
      progress: null,
    });
  };

  return {
    progressState,
    resetProgress,
  };
};
