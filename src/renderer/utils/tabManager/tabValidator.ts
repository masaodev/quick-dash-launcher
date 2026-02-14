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
  canDeleteTab(_tab: DataFileTab): ValidationResult {
    return { valid: true };
  },

  /**
   * ファイルをタブから削除できるかチェック
   */
  canRemoveFileFromTab(fileName: string, tabIndex: number, tabs: DataFileTab[]): ValidationResult {
    if (tabIndex < 0 || tabIndex >= tabs.length) {
      return { valid: false, reason: 'タブが見つかりません。' };
    }

    const tab = tabs[tabIndex];

    if (tab.files.length === 1) {
      return {
        valid: false,
        reason: 'タブには最低1つのファイルが必要です。タブごと削除してください。',
      };
    }

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

  isFileUsedInOtherTabs(fileName: string, excludeTabIndex: number, tabs: DataFileTab[]): boolean {
    return tabs.some((t, idx) => idx !== excludeTabIndex && t.files.includes(fileName));
  },

  canAddFileToTab(fileName: string, tab: DataFileTab): ValidationResult {
    if (tab.files.includes(fileName)) {
      return { valid: false, reason: 'このファイルは既にタブに含まれています。' };
    }
    return { valid: true };
  },
};
