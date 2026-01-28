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
   * @param savedState - 保存済み状態
   * @param currentTabs - 現在のタブリスト
   * @param currentLabels - 現在のラベル
   * @param pendingOps - 保留中のファイル操作
   * @returns 未保存変更がある場合はtrue
   *
   * @example
   * hasUnsavedChanges(
   *   { dataFileTabs: [{ name: 'メイン', files: ['data.json'] }], dataFileLabels: {} },
   *   [{ name: 'メイン変更後', files: ['data.json'] }],
   *   {},
   *   { filesToCreate: [], filesToDelete: [] }
   * ) // => true (タブ名が変更されている)
   */
  hasUnsavedChanges(
    savedState: SavedTabState,
    currentTabs: DataFileTab[],
    currentLabels: Record<string, string>,
    pendingOps: PendingFileOperations
  ): boolean {
    const hasTabsChange = JSON.stringify(savedState.dataFileTabs) !== JSON.stringify(currentTabs);
    const hasLabelsChange =
      JSON.stringify(savedState.dataFileLabels) !== JSON.stringify(currentLabels);
    const hasPendingOps =
      pendingOps.filesToCreate.length > 0 || pendingOps.filesToDelete.length > 0;

    return hasTabsChange || hasLabelsChange || hasPendingOps;
  },

  /**
   * ファイル削除時の操作タイプを判定
   * - 作成予定ファイルの削除 → 作成予定リストから削除
   * - 他タブで使用中 → タブからのみ削除
   * - 上記以外 → 削除予定リストに追加
   *
   * @param fileName - 削除対象のファイル名
   * @param pendingCreations - 作成予定のファイル名リスト
   * @param updatedTabs - ファイル削除後のタブリスト（削除対象のタブから既にファイルが削除されている状態）
   * @returns 削除タイプ
   *
   * @example
   * // 作成予定のファイルを削除
   * getFileDeletionType('data2.json', ['data2.json'], []) // => 'cancelCreation'
   *
   * // 他のタブでも使用されているファイルを削除
   * getFileDeletionType('data.json', [], [
   *   { name: 'メイン', files: ['data.json'] },
   *   { name: 'サブ1', files: ['data.json'] }
   * ]) // => 'removeFromTab'
   *
   * // 他のタブで使用されていないファイルを削除
   * getFileDeletionType('data2.json', [], [
   *   { name: 'メイン', files: ['data.json'] }
   * ]) // => 'scheduleDelete'
   */
  getFileDeletionType(
    fileName: string,
    pendingCreations: string[],
    updatedTabs: DataFileTab[]
  ): FileDeletionType {
    // 作成予定リストにあるファイルの場合は、作成予定リストから削除するだけ
    if (pendingCreations.includes(fileName)) {
      return 'cancelCreation';
    }

    // 他のタブでも使用されているかチェック
    const fileUsedInOtherTabs = updatedTabs.some((t) => t.files.includes(fileName));

    // 他のタブで使用されている場合はタブから削除するだけ
    if (fileUsedInOtherTabs) {
      return 'removeFromTab';
    }

    // 上記以外は削除予定リストに追加
    return 'scheduleDelete';
  },

  /**
   * タブ削除時に物理削除すべきファイルを計算
   * @param tabIndex - 削除対象のタブインデックス
   * @param pendingCreations - 作成予定のファイル名リスト
   * @param allTabs - 全タブのリスト（削除対象のタブを含む）
   * @returns 削除すべきファイル名のリスト
   *
   * @example
   * // タブに含まれるファイルが他のタブで使用されていない場合
   * getFilesToDeleteOnTabRemoval(
   *   1,
   *   [],
   *   [
   *     { name: 'メイン', files: ['data.json'] },
   *     { name: 'サブ1', files: ['data2.json'] }
   *   ]
   * ) // => ['data2.json']
   *
   * // タブに含まれるファイルが他のタブでも使用されている場合
   * getFilesToDeleteOnTabRemoval(
   *   1,
   *   [],
   *   [
   *     { name: 'メイン', files: ['data.json'] },
   *     { name: 'サブ1', files: ['data.json'] }
   *   ]
   * ) // => [] (data.jsonは他のタブでも使用されているため削除しない)
   *
   * // 作成予定のファイルは削除リストに含めない
   * getFilesToDeleteOnTabRemoval(
   *   1,
   *   ['data2.json'],
   *   [
   *     { name: 'メイン', files: ['data.json'] },
   *     { name: 'サブ1', files: ['data2.json'] }
   *   ]
   * ) // => [] (data2.jsonは作成予定なので削除リストに含めない)
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
    const filesToDelete: string[] = [];

    // タブ削除後の状態を計算（削除対象のタブを除外）
    const updatedTabs = allTabs.filter((_, idx) => idx !== tabIndex);

    for (const fileName of tab.files) {
      // 作成予定リストにあるファイルの場合はスキップ（削除リストに追加しない）
      if (pendingCreations.includes(fileName)) {
        continue;
      }

      // 他のタブでも使用されているかチェック
      const fileUsedInOtherTabs = updatedTabs.some((t) => t.files.includes(fileName));

      // 他のタブで使用されていない場合のみ削除リストに追加
      if (!fileUsedInOtherTabs) {
        filesToDelete.push(fileName);
      }
    }

    return filesToDelete;
  },
};
