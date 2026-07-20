import { useState, useEffect } from 'react';
import { IconProgress, IconProgressState } from '@common/types';

export function useIconProgress(): {
  progressState: IconProgressState;
  resetProgress: () => void;
} {
  const [progressState, setProgressState] = useState<IconProgressState>({
    isActive: false,
    progress: null,
  });

  useEffect(() => {
    // IPCイベントリスナーを設定
    const handleProgressStart = (data: IconProgress) => {
      setProgressState({
        isActive: true,
        progress: data,
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

      // 自動的に閉じない（ユーザーが×ボタンで手動で閉じる）
    };

    // IPCイベントリスナーを登録（再マウント時の多重登録を防ぐため必ず解除する）
    const cleanups: Array<() => void> = [];
    if (window.electronAPI && window.electronAPI.onIconProgress) {
      cleanups.push(
        window.electronAPI.onIconProgress('start', handleProgressStart),
        window.electronAPI.onIconProgress('update', handleProgressUpdate),
        window.electronAPI.onIconProgress('complete', handleProgressComplete)
      );
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  function resetProgress(): void {
    setProgressState({
      isActive: false,
      progress: null,
    });
  }

  return {
    progressState,
    resetProgress,
  };
}
