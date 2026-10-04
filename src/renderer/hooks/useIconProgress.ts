import { useState, useEffect, useRef } from 'react';
import { IconProgress, IconProgressState } from '@common/types';

export function useIconProgress(): {
  progressState: IconProgressState;
  resetProgress: () => void;
} {
  const [progressState, setProgressState] = useState<IconProgressState>({
    isActive: false,
    progress: null,
  });
  // × で閉じた取得の開始時刻。同じ取得の進捗が届いても再表示しない（次の取得では表示する）
  const dismissedStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const isDismissed = (data: IconProgress) => data.startTime === dismissedStartTimeRef.current;

    // IPCイベントリスナーを設定
    const handleProgressStart = (data: IconProgress) => {
      if (isDismissed(data)) return;
      dismissedStartTimeRef.current = null;
      setProgressState({
        isActive: true,
        progress: data,
      });
    };

    const handleProgressUpdate = (data: IconProgress) => {
      if (isDismissed(data)) return;
      setProgressState({
        isActive: true,
        progress: data,
      });
    };

    const handleProgressComplete = (data: IconProgress) => {
      if (isDismissed(data)) return;
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
    dismissedStartTimeRef.current = progressState.progress?.startTime ?? null;
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
