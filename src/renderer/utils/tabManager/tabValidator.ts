import { DEFAULT_DATA_FILE, DataFileTab } from '@common/types';

/**
 * バリデーション結果
 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * タブ・ファイル操作の妥当性検証
 * すべて純粋関数として実装（副作用なし）
 */
export const TabValidator = {
  /**
   * タブ削除が可能かチェック
   * @param _tab - 削除対象のタブ（現時点では未使用）
   * @returns バリデーション結果
   *
   * @example
   * canDeleteTab({ name: 'メイン', files: ['datafiles/data.json'] }) // => { valid: true }
   */
  canDeleteTab(_tab: DataFileTab): ValidationResult {
    // 現時点では特に制約なし（将来的に追加可能）
    return { valid: true };
  },

  /**
   * ファイルをタブから削除できるかチェック
   * - タブには最低1つのファイルが必要
   * - datafiles/data.jsonは最低1つのタブに含まれる必要がある
   *
   * @param fileName - 削除対象のファイル名
   * @param tabIndex - 削除対象のタブインデックス
   * @param tabs - 全タブのリスト
   * @returns バリデーション結果
   *
   * @example
   * // タブに1つしかファイルがない場合
   * canRemoveFileFromTab('datafiles/data.json', 0, [{ name: 'メイン', files: ['datafiles/data.json'] }])
   * // => { valid: false, reason: 'タブには最低1つのファイルが必要です...' }
   *
   * // datafiles/data.jsonが他のタブにない場合
   * canRemoveFileFromTab('datafiles/data.json', 0, [
   *   { name: 'メイン', files: ['datafiles/data.json', 'datafiles/data2.json'] },
   *   { name: 'サブ1', files: ['datafiles/data2.json'] }
   * ])
   * // => { valid: false, reason: 'datafiles/data.jsonは最低1つのタブに含まれている必要があります...' }
   */
  canRemoveFileFromTab(fileName: string, tabIndex: number, tabs: DataFileTab[]): ValidationResult {
    if (tabIndex < 0 || tabIndex >= tabs.length) {
      return { valid: false, reason: 'タブが見つかりません。' };
    }

    const tab = tabs[tabIndex];

    // タブに最低1つのファイルが必要
    if (tab.files.length === 1) {
      return {
        valid: false,
        reason: 'タブには最低1つのファイルが必要です。タブごと削除してください。',
      };
    }

    // メインデータファイルの場合、他のタブにも存在するかチェック
    if (fileName === DEFAULT_DATA_FILE) {
      const otherTabsWithMainFile = tabs.filter(
        (t, idx) => idx !== tabIndex && t.files.includes(DEFAULT_DATA_FILE)
      );
      if (otherTabsWithMainFile.length === 0) {
        return {
          valid: false,
          reason: `${DEFAULT_DATA_FILE}は最低1つのタブに含まれている必要があります。\n他のタブに${DEFAULT_DATA_FILE}を追加してから削除してください。`,
        };
      }
    }

    return { valid: true };
  },

  /**
   * ファイルが他のタブでも使用されているかチェック
   * @param fileName - チェック対象のファイル名
   * @param excludeTabIndex - 除外するタブインデックス
   * @param tabs - 全タブのリスト
   * @returns 他のタブで使用されている場合はtrue
   *
   * @example
   * isFileUsedInOtherTabs('datafiles/data.json', 0, [
   *   { name: 'メイン', files: ['datafiles/data.json'] },
   *   { name: 'サブ1', files: ['datafiles/data.json'] }
   * ]) // => true
   *
   * isFileUsedInOtherTabs('datafiles/data2.json', 0, [
   *   { name: 'メイン', files: ['datafiles/data.json', 'datafiles/data2.json'] },
   *   { name: 'サブ1', files: ['datafiles/data.json'] }
   * ]) // => false
   */
  isFileUsedInOtherTabs(fileName: string, excludeTabIndex: number, tabs: DataFileTab[]): boolean {
    return tabs.some((t, idx) => idx !== excludeTabIndex && t.files.includes(fileName));
  },

  /**
   * タブにファイルを追加できるかチェック
   * @param fileName - 追加対象のファイル名
   * @param tab - 追加先のタブ
   * @returns バリデーション結果
   *
   * @example
   * canAddFileToTab('datafiles/data.json', { name: 'メイン', files: ['datafiles/data.json'] })
   * // => { valid: false, reason: 'このファイルは既にタブに含まれています。' }
   *
   * canAddFileToTab('datafiles/data2.json', { name: 'メイン', files: ['datafiles/data.json'] })
   * // => { valid: true }
   */
  canAddFileToTab(fileName: string, tab: DataFileTab): ValidationResult {
    if (tab.files.includes(fileName)) {
      return {
        valid: false,
        reason: 'このファイルは既にタブに含まれています。',
      };
    }

    return { valid: true };
  },
};
