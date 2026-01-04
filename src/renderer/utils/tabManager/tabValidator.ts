import { DataFileTab } from '@common/types';

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
   * canDeleteTab({ name: 'メイン', files: ['data.txt'] }) // => { valid: true }
   */
  canDeleteTab(_tab: DataFileTab): ValidationResult {
    // 現時点では特に制約なし（将来的に追加可能）
    return { valid: true };
  },

  /**
   * ファイルをタブから削除できるかチェック
   * - タブには最低1つのファイルが必要
   * - data.txtは最低1つのタブに含まれる必要がある
   *
   * @param fileName - 削除対象のファイル名
   * @param tabIndex - 削除対象のタブインデックス
   * @param tabs - 全タブのリスト
   * @returns バリデーション結果
   *
   * @example
   * // タブに1つしかファイルがない場合
   * canRemoveFileFromTab('data.txt', 0, [{ name: 'メイン', files: ['data.txt'] }])
   * // => { valid: false, reason: 'タブには最低1つのファイルが必要です...' }
   *
   * // data.txtが他のタブにない場合
   * canRemoveFileFromTab('data.txt', 0, [
   *   { name: 'メイン', files: ['data.txt', 'data2.txt'] },
   *   { name: 'サブ1', files: ['data2.txt'] }
   * ])
   * // => { valid: false, reason: 'data.txtは最低1つのタブに含まれている必要があります...' }
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

    // data.txtの場合、他のタブにもdata.txtが存在するかチェック
    if (fileName === 'data.txt') {
      const otherTabsWithDataTxt = tabs.filter(
        (t, idx) => idx !== tabIndex && t.files.includes('data.txt')
      );
      if (otherTabsWithDataTxt.length === 0) {
        return {
          valid: false,
          reason:
            'data.txtは最低1つのタブに含まれている必要があります。\n他のタブにdata.txtを追加してから削除してください。',
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
   * isFileUsedInOtherTabs('data.txt', 0, [
   *   { name: 'メイン', files: ['data.txt'] },
   *   { name: 'サブ1', files: ['data.txt'] }
   * ]) // => true
   *
   * isFileUsedInOtherTabs('data2.txt', 0, [
   *   { name: 'メイン', files: ['data.txt', 'data2.txt'] },
   *   { name: 'サブ1', files: ['data.txt'] }
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
   * canAddFileToTab('data.txt', { name: 'メイン', files: ['data.txt'] })
   * // => { valid: false, reason: 'このファイルは既にタブに含まれています。' }
   *
   * canAddFileToTab('data2.txt', { name: 'メイン', files: ['data.txt'] })
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
