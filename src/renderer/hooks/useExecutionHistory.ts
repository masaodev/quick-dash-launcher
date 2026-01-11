import { useState, useEffect, useCallback } from 'react';
import { ExecutionHistoryItem } from '@common/types';

import { logError } from '../utils/debug';

/**
 * 実行履歴の管理を行うカスタムフック
 */
export function useExecutionHistory() {
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryItem[]>([]);

  // 実行履歴をロードする
  const loadHistory = useCallback(async () => {
    try {
      const entries = await window.electronAPI.workspaceAPI.loadExecutionHistory();
      setExecutionHistory(entries);
    } catch (error) {
      logError('実行履歴の読み込みに失敗しました:', error);
    }
  }, []);

  // 初回ロード
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ワークスペース変更通知のリスナー
  useEffect(() => {
    const unsubscribe = window.electronAPI.onWorkspaceChanged(() => {
      loadHistory();
    });

    return () => {
      unsubscribe();
    };
  }, [loadHistory]);

  return {
    executionHistory,
    loadHistory,
  };
}
