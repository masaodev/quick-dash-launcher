import { describe, it, expect } from 'vitest';

import { SETTINGS_RESET_KEYS, isResettableCategory } from './settingsResetKeys';

describe('SETTINGS_RESET_KEYS', () => {
  it('ホットキーを含まないこと（空に戻すと次回起動が初回起動扱いになる）', () => {
    for (const keys of Object.values(SETTINGS_RESET_KEYS)) {
      expect(keys).not.toContain('hotkey');
      expect(keys).not.toContain('itemSearchHotkey');
    }
  });

  it('タブ構成とブックマーク自動取込を含まないこと（別カテゴリで管理する）', () => {
    for (const keys of Object.values(SETTINGS_RESET_KEYS)) {
      expect(keys).not.toContain('showDataFileTabs');
      expect(keys).not.toContain('dataFileTabs');
      expect(keys).not.toContain('dataFileLabels');
      expect(keys).not.toContain('defaultFileTab');
      expect(keys).not.toContain('bookmarkAutoImport');
    }
  });

  it('メタ情報（$schema・バージョン）を含まないこと', () => {
    for (const keys of Object.values(SETTINGS_RESET_KEYS)) {
      expect(keys).not.toContain('$schema');
      expect(keys).not.toContain('createdWithVersion');
      expect(keys).not.toContain('updatedWithVersion');
    }
  });

  it('カテゴリ間で項目が重複しないこと', () => {
    const all = Object.values(SETTINGS_RESET_KEYS).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('既定値に戻すを置くカテゴリだけを対象にすること', () => {
    expect(isResettableCategory('basic')).toBe(true);
    expect(isResettableCategory('window')).toBe(true);
    expect(isResettableCategory('backup')).toBe(true);
    expect(isResettableCategory('tabs')).toBe(false);
    expect(isResettableCategory('bookmarkAutoImport')).toBe(false);
  });
});
