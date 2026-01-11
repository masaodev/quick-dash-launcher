import { useState, useEffect } from 'react';
import type { WorkspaceItem, WorkspaceGroup, ExecutionHistoryItem } from '@common/types';
import { logError } from '../../utils/debug';

/**
 * ワークスペースのデータ管理フック
 *
 * アイテム、グループ、実行履歴のデータ読み込みと状態管理を行います。
 * ワークスペース変更イベントをリッスンして自動的にデータを再読み込みします。
 *
 * @returns データの状態と読み込み関数
 *
 * @example
 * ```tsx
 * const { items, groups, executionHistory, loadItems, loadGroups, loadExecutionHistory } = useWorkspaceData();
 *
 * // データは自動的に読み込まれ、変更時も自動更新されます
 * console.log(items.length, groups.length, executionHistory.length);
 *
 * // 手動で再読み込みも可能
 * await loadItems();
 * ```
 */
export function useWorkspaceData() {
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [groups, setGroups] = useState<WorkspaceGroup[]>([]);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistoryItem[]>([]);

  /**
   * ワークスペースアイテムを読み込み
   */
  const loadItems = async () => {
    try {
      const loadedItems = await window.electronAPI.workspaceAPI.loadItems();
      setItems(loadedItems);
    } catch (error) {
      logError('Failed to load workspace items:', error);
    }
  };

  /**
   * ワークスペースグループを読み込み
   */
  const loadGroups = async () => {
    try {
      const loadedGroups = await window.electronAPI.workspaceAPI.loadGroups();
      setGroups(loadedGroups);
    } catch (error) {
      logError('Failed to load workspace groups:', error);
    }
  };

  /**
   * 実行履歴を読み込み
   */
  const loadExecutionHistory = async () => {
    try {
      const history = await window.electronAPI.workspaceAPI.loadExecutionHistory();
      setExecutionHistory(history);
    } catch (error) {
      logError('Failed to load execution history:', error);
    }
  };

  // 初期データ読み込みと変更イベントリスニング
  useEffect(() => {
    loadItems();
    loadGroups();
    loadExecutionHistory();

    // ワークスペース変更イベントをリッスン
    const unsubscribe = window.electronAPI.onWorkspaceChanged(() => {
      loadItems();
      loadGroups();
      loadExecutionHistory();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return {
    items,
    groups,
    executionHistory,
    loadItems,
    loadGroups,
    loadExecutionHistory,
  };
}
