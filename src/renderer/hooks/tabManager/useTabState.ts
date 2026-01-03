import { useState, useEffect, useMemo, Dispatch, SetStateAction } from 'react';
import { AppSettings } from '@common/types';

import { TabStateCalculator, SavedTabState, PendingFileOperations } from '../../utils/tabManager';

interface UseTabStateProps {
  editedSettings: AppSettings;
}

interface UseTabStateReturn {
  expandedTabs: Set<number>;
  setExpandedTabs: Dispatch<SetStateAction<Set<number>>>;
  savedTabsState: SavedTabState | null;
  setSavedTabsState: Dispatch<SetStateAction<SavedTabState | null>>;
  pendingFileOperations: PendingFileOperations;
  setPendingFileOperations: Dispatch<SetStateAction<PendingFileOperations>>;
  fileModalTabIndex: number | null;
  setFileModalTabIndex: Dispatch<SetStateAction<number | null>>;
  hasUnsavedChanges: boolean;
}

/**
 * タブ管理の状態管理フック
 *
 * 責務:
 * - アコーディオン展開状態の管理
 * - 保存済み状態の管理（キャンセル時の復元用）
 * - 保留中のファイル操作の管理
 * - 未保存変更の検知
 */
export function useTabState({ editedSettings }: UseTabStateProps): UseTabStateReturn {
  // アコーディオン展開状態（タブインデックスのセット）
  const [expandedTabs, setExpandedTabs] = useState<Set<number>>(new Set());

  // 保存済み状態（キャンセル時に復元するため）
  const [savedTabsState, setSavedTabsState] = useState<SavedTabState | null>(null);

  // 保留中のファイル操作
  const [pendingFileOperations, setPendingFileOperations] = useState<PendingFileOperations>({
    filesToCreate: [],
    filesToDelete: [],
  });

  // ファイル管理モーダルの状態
  const [fileModalTabIndex, setFileModalTabIndex] = useState<number | null>(null);

  // 初回表示時に保存済み状態を記録
  useEffect(() => {
    setSavedTabsState({
      dataFileTabs: editedSettings.dataFileTabs || [],
      dataFileLabels: editedSettings.dataFileLabels || {},
    });
  }, []);

  // 未保存変更の検知
  const hasUnsavedChanges = useMemo(() => {
    if (!savedTabsState) return false;

    return TabStateCalculator.hasUnsavedChanges(
      savedTabsState,
      editedSettings.dataFileTabs || [],
      editedSettings.dataFileLabels || {},
      pendingFileOperations
    );
  }, [
    editedSettings.dataFileTabs,
    editedSettings.dataFileLabels,
    savedTabsState,
    pendingFileOperations,
  ]);

  return {
    expandedTabs,
    setExpandedTabs,
    savedTabsState,
    setSavedTabsState,
    pendingFileOperations,
    setPendingFileOperations,
    fileModalTabIndex,
    setFileModalTabIndex,
    hasUnsavedChanges,
  };
}
