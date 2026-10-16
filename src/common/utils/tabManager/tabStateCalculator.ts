import { DataFileTab } from '@common/types';

/**
 * 保存済み状態
 */
export interface SavedTabState {
  dataFileTabs: DataFileTab[];
  dataFileLabels: Record<string, string>;
}

/**
 * 保留中のファイル操作
 */
export interface PendingFileOperations {
  filesToCreate: string[];
  filesToDelete: string[];
}

/**
 * ファイル削除タイプ
 */
export type FileDeletionType = 'cancelCreation' | 'removeFromTab' | 'scheduleDelete';

/**
 * 状態の差分計算と変更検知
 * すべて純粋関数として実装（副作用なし）
 */
export const TabStateCalculator = {
  /**
   * 未保存変更があるかチェック
   */
  hasUnsavedChanges(
    savedState: SavedTabState,
    currentTabs: DataFileTab[],
    currentLabels: Record<string, string>,
    pendingOps: PendingFileOperations
  ): boolean {
    return (
      JSON.stringify(savedState.dataFileTabs) !== JSON.stringify(currentTabs) ||
      JSON.stringify(savedState.dataFileLabels) !== JSON.stringify(currentLabels) ||
      pendingOps.filesToCreate.length > 0 ||
      pendingOps.filesToDelete.length > 0
    );
  },

  /**
   * ファイル削除時の操作タイプを判定
   * - 作成予定ファイルの削除 → cancelCreation
   * - 他タブで使用中 → removeFromTab
   * - 上記以外 → scheduleDelete
   */
  getFileDeletionType(
    fileName: string,
    pendingCreations: string[],
    updatedTabs: DataFileTab[]
  ): FileDeletionType {
    if (pendingCreations.includes(fileName)) return 'cancelCreation';
    if (updatedTabs.some((t) => t.files.includes(fileName))) return 'removeFromTab';
    return 'scheduleDelete';
  },

  /**
   * タブ削除時に物理削除すべきファイルを計算
   */
  getFilesToDeleteOnTabRemoval(
    tabIndex: number,
    pendingCreations: string[],
    allTabs: DataFileTab[]
  ): string[] {
    if (tabIndex < 0 || tabIndex >= allTabs.length) {
      return [];
    }

    const tab = allTabs[tabIndex];
    const remainingTabs = allTabs.filter((_, idx) => idx !== tabIndex);

    return tab.files.filter((fileName) => {
      if (pendingCreations.includes(fileName)) return false;
      return !remainingTabs.some((t) => t.files.includes(fileName));
    });
  },
};
