import { useState, useEffect, useCallback } from 'react';
import type { LayoutExecutionProgress } from '@common/types';

export function useLayoutProgress() {
  const [isOpen, setIsOpen] = useState(false);
  const [progress, setProgress] = useState<LayoutExecutionProgress | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.onLayoutProgress) return;

    const unsubStart = window.electronAPI.onLayoutProgress('start', (data) => {
      setProgress(data);
      setIsOpen(true);
    });

    const unsubUpdate = window.electronAPI.onLayoutProgress('update', (data) => {
      setProgress(data);
    });

    const unsubComplete = window.electronAPI.onLayoutProgress('complete', (data) => {
      setProgress(data);
      // 全て成功した場合は自動的に閉じる
      const allSuccess = data.entries.every((e) => e.status === 'success');
      if (allSuccess && !data.isCancelled) {
        setTimeout(() => {
          setIsOpen(false);
          setProgress(null);
        }, 2000);
      }
    });

    return () => {
      unsubStart();
      unsubUpdate();
      unsubComplete();
    };
  }, []);

  // モーダル表示中はフォーカスが外れてもウィンドウを閉じない
  useEffect(() => {
    if (isOpen) {
      window.electronAPI?.setModalMode(true);
    }
    return () => {
      if (isOpen) {
        window.electronAPI?.setModalMode(false);
      }
    };
  }, [isOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    setProgress(null);
  }, []);

  const cancel = useCallback(() => {
    window.electronAPI?.cancelLayout();
  }, []);

  return { isOpen, progress, close, cancel };
}
