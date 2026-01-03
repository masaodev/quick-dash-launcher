import { describe, it, expect } from 'vitest';
import { DataFileTab } from '@common/types';

import { TabValidator } from '../tabValidator';

describe('TabValidator', () => {
  describe('canDeleteTab', () => {
    it('タブ削除は常に許可される', () => {
      const tab: DataFileTab = { name: 'メイン', files: ['data.txt'] };
      const result = TabValidator.canDeleteTab(tab);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('canRemoveFileFromTab', () => {
    it('タブに1つしかファイルがない場合は削除不可', () => {
      const tabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt'] }];
      const result = TabValidator.canRemoveFileFromTab('data.txt', 0, tabs);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('タブには最低1つのファイルが必要です。タブごと削除してください。');
    });

    it('タブに複数ファイルがある場合は削除可能', () => {
      const tabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt', 'data2.txt'] }];
      const result = TabValidator.canRemoveFileFromTab('data2.txt', 0, tabs);
      expect(result.valid).toBe(true);
    });

    it('data.txtが他のタブにも存在する場合は削除可能', () => {
      const tabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt', 'data2.txt'] },
        { name: 'サブ1', files: ['data.txt'] },
      ];
      const result = TabValidator.canRemoveFileFromTab('data.txt', 0, tabs);
      expect(result.valid).toBe(true);
    });

    it('data.txtが他のタブに存在しない場合は削除不可', () => {
      const tabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt', 'data2.txt'] },
        { name: 'サブ1', files: ['data2.txt'] },
      ];
      const result = TabValidator.canRemoveFileFromTab('data.txt', 0, tabs);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe(
        'data.txtは最低1つのタブに含まれている必要があります。\n他のタブにdata.txtを追加してから削除してください。'
      );
    });

    it('data.txt以外のファイルは他のタブに存在しなくても削除可能', () => {
      const tabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt', 'data2.txt'] },
        { name: 'サブ1', files: ['data.txt'] },
      ];
      const result = TabValidator.canRemoveFileFromTab('data2.txt', 0, tabs);
      expect(result.valid).toBe(true);
    });

    it('タブインデックスが範囲外の場合はエラー', () => {
      const tabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt'] }];
      const result = TabValidator.canRemoveFileFromTab('data.txt', 1, tabs);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('タブが見つかりません。');
    });

    it('タブインデックスが負の場合はエラー', () => {
      const tabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt'] }];
      const result = TabValidator.canRemoveFileFromTab('data.txt', -1, tabs);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('タブが見つかりません。');
    });
  });

  describe('isFileUsedInOtherTabs', () => {
    it('他のタブでも使用されている場合はtrueを返す', () => {
      const tabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt'] },
        { name: 'サブ1', files: ['data.txt'] },
      ];
      expect(TabValidator.isFileUsedInOtherTabs('data.txt', 0, tabs)).toBe(true);
    });

    it('他のタブで使用されていない場合はfalseを返す', () => {
      const tabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt', 'data2.txt'] },
        { name: 'サブ1', files: ['data.txt'] },
      ];
      expect(TabValidator.isFileUsedInOtherTabs('data2.txt', 0, tabs)).toBe(false);
    });

    it('除外タブのみで使用されている場合はfalseを返す', () => {
      const tabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt', 'data2.txt'] },
        { name: 'サブ1', files: ['data.txt'] },
      ];
      expect(TabValidator.isFileUsedInOtherTabs('data2.txt', 0, tabs)).toBe(false);
    });

    it('複数の他のタブで使用されている場合はtrueを返す', () => {
      const tabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt'] },
        { name: 'サブ1', files: ['data.txt'] },
        { name: 'サブ2', files: ['data.txt'] },
      ];
      expect(TabValidator.isFileUsedInOtherTabs('data.txt', 0, tabs)).toBe(true);
    });

    it('どのタブでも使用されていない場合はfalseを返す', () => {
      const tabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt'] }];
      expect(TabValidator.isFileUsedInOtherTabs('data2.txt', 0, tabs)).toBe(false);
    });
  });

  describe('canAddFileToTab', () => {
    it('ファイルが既にタブに含まれている場合は追加不可', () => {
      const tab: DataFileTab = { name: 'メイン', files: ['data.txt'] };
      const result = TabValidator.canAddFileToTab('data.txt', tab);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('このファイルは既にタブに含まれています。');
    });

    it('ファイルがタブに含まれていない場合は追加可能', () => {
      const tab: DataFileTab = { name: 'メイン', files: ['data.txt'] };
      const result = TabValidator.canAddFileToTab('data2.txt', tab);
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('空のタブにはファイルを追加可能', () => {
      const tab: DataFileTab = { name: 'メイン', files: [] };
      const result = TabValidator.canAddFileToTab('data.txt', tab);
      expect(result.valid).toBe(true);
    });
  });
});
