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
