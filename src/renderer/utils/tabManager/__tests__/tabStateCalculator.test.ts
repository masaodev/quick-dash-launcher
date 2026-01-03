import { describe, it, expect } from 'vitest';
import { TabStateCalculator } from '../tabStateCalculator';
import type { SavedTabState, PendingFileOperations } from '../tabStateCalculator';
import { DataFileTab } from '@common/types';

describe('TabStateCalculator', () => {
  describe('hasUnsavedChanges', () => {
    it('保存済み状態と現在の状態が同じ場合はfalseを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.txt'] }],
        dataFileLabels: { 'data.txt': 'メイン用データファイル' },
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt'] }];
      const currentLabels = { 'data.txt': 'メイン用データファイル' };
      const pendingOps: PendingFileOperations = { filesToCreate: [], filesToDelete: [] };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(false);
    });

    it('タブ名が変更されている場合はtrueを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.txt'] }],
        dataFileLabels: {},
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン変更後', files: ['data.txt'] }];
      const currentLabels = {};
      const pendingOps: PendingFileOperations = { filesToCreate: [], filesToDelete: [] };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(true);
    });

    it('タブにファイルが追加されている場合はtrueを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.txt'] }],
        dataFileLabels: {},
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt', 'data2.txt'] }];
      const currentLabels = {};
      const pendingOps: PendingFileOperations = { filesToCreate: [], filesToDelete: [] };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(true);
    });

    it('ラベルが変更されている場合はtrueを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.txt'] }],
        dataFileLabels: { 'data.txt': 'メイン用データファイル' },
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt'] }];
      const currentLabels = { 'data.txt': 'カスタムラベル' };
      const pendingOps: PendingFileOperations = { filesToCreate: [], filesToDelete: [] };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(true);
    });

    it('ファイル作成が保留中の場合はtrueを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.txt'] }],
        dataFileLabels: {},
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt'] }];
      const currentLabels = {};
      const pendingOps: PendingFileOperations = { filesToCreate: ['data2.txt'], filesToDelete: [] };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(true);
    });

    it('ファイル削除が保留中の場合はtrueを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.txt'] }],
        dataFileLabels: {},
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt'] }];
      const currentLabels = {};
      const pendingOps: PendingFileOperations = {
        filesToCreate: [],
        filesToDelete: ['data2.txt'],
      };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(true);
    });

    it('複数の変更が同時に発生している場合はtrueを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.txt'] }],
        dataFileLabels: {},
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン変更後', files: ['data.txt'] }];
      const currentLabels = { 'data.txt': 'カスタムラベル' };
      const pendingOps: PendingFileOperations = {
        filesToCreate: ['data2.txt'],
        filesToDelete: ['data3.txt'],
      };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(true);
    });
  });

  describe('getFileDeletionType', () => {
    it('作成予定のファイルを削除する場合はcancelCreationを返す', () => {
      const updatedTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt'] }];
      const result = TabStateCalculator.getFileDeletionType(
        'data2.txt',
        ['data2.txt'],
        updatedTabs
      );
      expect(result).toBe('cancelCreation');
    });

    it('他のタブでも使用されているファイルを削除する場合はremoveFromTabを返す', () => {
      const updatedTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt'] },
        { name: 'サブ1', files: ['data.txt'] },
      ];
      const result = TabStateCalculator.getFileDeletionType('data.txt', [], updatedTabs);
      expect(result).toBe('removeFromTab');
    });

    it('他のタブで使用されていないファイルを削除する場合はscheduleDeleteを返す', () => {
      const updatedTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt'] }];
      const result = TabStateCalculator.getFileDeletionType('data2.txt', [], updatedTabs);
      expect(result).toBe('scheduleDelete');
    });

    it('作成予定かつ他のタブでも使用されている場合はcancelCreationを優先', () => {
      const updatedTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data2.txt'] },
        { name: 'サブ1', files: ['data2.txt'] },
      ];
      const result = TabStateCalculator.getFileDeletionType(
        'data2.txt',
        ['data2.txt'],
        updatedTabs
      );
      expect(result).toBe('cancelCreation');
    });
  });

  describe('getFilesToDeleteOnTabRemoval', () => {
    it('タブに含まれるファイルが他のタブで使用されていない場合は削除リストに含める', () => {
      const allTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt'] },
        { name: 'サブ1', files: ['data2.txt'] },
      ];
      const result = TabStateCalculator.getFilesToDeleteOnTabRemoval(1, [], allTabs);
      expect(result).toEqual(['data2.txt']);
    });

    it('タブに含まれるファイルが他のタブでも使用されている場合は削除リストに含めない', () => {
      const allTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt'] },
        { name: 'サブ1', files: ['data.txt'] },
      ];
      const result = TabStateCalculator.getFilesToDeleteOnTabRemoval(1, [], allTabs);
      expect(result).toEqual([]);
    });

    it('作成予定のファイルは削除リストに含めない', () => {
      const allTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt'] },
        { name: 'サブ1', files: ['data2.txt'] },
      ];
      const result = TabStateCalculator.getFilesToDeleteOnTabRemoval(1, ['data2.txt'], allTabs);
      expect(result).toEqual([]);
    });

    it('複数ファイルがあり、一部は他のタブでも使用されている場合', () => {
      const allTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt'] },
        { name: 'サブ1', files: ['data.txt', 'data2.txt'] },
      ];
      const result = TabStateCalculator.getFilesToDeleteOnTabRemoval(1, [], allTabs);
      // data.txtは他のタブでも使用されているため削除しない
      // data2.txtは他のタブで使用されていないため削除する
      expect(result).toEqual(['data2.txt']);
    });

    it('複数ファイルがあり、すべて他のタブでも使用されている場合', () => {
      const allTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt', 'data2.txt'] },
        { name: 'サブ1', files: ['data.txt', 'data2.txt'] },
      ];
      const result = TabStateCalculator.getFilesToDeleteOnTabRemoval(1, [], allTabs);
      expect(result).toEqual([]);
    });

    it('複数ファイルがあり、すべて他のタブで使用されていない場合', () => {
      const allTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt'] },
        { name: 'サブ1', files: ['data2.txt', 'data3.txt'] },
      ];
      const result = TabStateCalculator.getFilesToDeleteOnTabRemoval(1, [], allTabs);
      expect(result).toEqual(['data2.txt', 'data3.txt']);
    });

    it('範囲外のタブインデックスの場合は空配列を返す', () => {
      const allTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt'] }];
      expect(TabStateCalculator.getFilesToDeleteOnTabRemoval(1, [], allTabs)).toEqual([]);
      expect(TabStateCalculator.getFilesToDeleteOnTabRemoval(-1, [], allTabs)).toEqual([]);
    });
  });
});
