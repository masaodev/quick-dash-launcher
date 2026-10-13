import i18next from 'i18next';
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
      return { valid: false, reason: i18next.t('itemManager.tabStructure.errors.tabNotFound') };
    }

    const tab = tabs[tabIndex];

    if (tab.files.length === 1) {
      return {
        valid: false,
        reason: i18next.t('itemManager.tabStructure.errors.tabNeedsFile'),
      };
    }

    if (fileName === DEFAULT_DATA_FILE) {
      const otherTabsWithMainFile = tabs.filter(
        (t, idx) => idx !== tabIndex && t.files.includes(DEFAULT_DATA_FILE)
      );
      if (otherTabsWithMainFile.length === 0) {
        return {
          valid: false,
          reason: i18next.t('itemManager.tabStructure.errors.mainFileRequired', {
            file: DEFAULT_DATA_FILE,
          }),
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
      return {
        valid: false,
        reason: i18next.t('itemManager.tabStructure.errors.fileAlreadyInTab'),
      };
    }
    return { valid: true };
  },
};
