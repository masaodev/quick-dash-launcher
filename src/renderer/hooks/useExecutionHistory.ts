import { useState, useEffect, useCallback } from 'react';
import { ExecutionHistoryItem } from '@common/types';

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
      console.error('実行履歴の読み込みに失敗しました:', error);
    }
  }, []);

  // 初回ロード
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return {
    executionHistory,
    loadHistory,
  };
}
