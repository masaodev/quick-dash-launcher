import { describe, it, expect } from 'vitest';
import { DataFileTab } from '@common/types';

import { TabStateCalculator } from '../tabStateCalculator';
import type { SavedTabState, PendingFileOperations } from '../tabStateCalculator';

describe('TabStateCalculator', () => {
  describe('hasUnsavedChanges', () => {
    it('保存済み状態と現在の状態が同じ場合はfalseを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.json'] }],
        dataFileLabels: { 'data.json': 'メイン用データファイル' },
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.json'] }];
      const currentLabels = { 'data.json': 'メイン用データファイル' };
      const pendingOps: PendingFileOperations = { filesToCreate: [], filesToDelete: [] };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(false);
    });

    it('タブ名が変更されている場合はtrueを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.json'] }],
        dataFileLabels: {},
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン変更後', files: ['data.json'] }];
      const currentLabels = {};
      const pendingOps: PendingFileOperations = { filesToCreate: [], filesToDelete: [] };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(true);
    });

    it('タブにファイルが追加されている場合はtrueを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.json'] }],
        dataFileLabels: {},
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.json', 'data2.json'] }];
      const currentLabels = {};
      const pendingOps: PendingFileOperations = { filesToCreate: [], filesToDelete: [] };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(true);
    });

    it('ラベルが変更されている場合はtrueを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.json'] }],
        dataFileLabels: { 'data.json': 'メイン用データファイル' },
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.json'] }];
      const currentLabels = { 'data.json': 'カスタムラベル' };
      const pendingOps: PendingFileOperations = { filesToCreate: [], filesToDelete: [] };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(true);
    });

    it('ファイル作成が保留中の場合はtrueを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.json'] }],
        dataFileLabels: {},
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.json'] }];
      const currentLabels = {};
      const pendingOps: PendingFileOperations = {
        filesToCreate: ['data2.json'],
        filesToDelete: [],
      };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(true);
    });

    it('ファイル削除が保留中の場合はtrueを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.json'] }],
        dataFileLabels: {},
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.json'] }];
      const currentLabels = {};
      const pendingOps: PendingFileOperations = {
        filesToCreate: [],
        filesToDelete: ['data2.json'],
      };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(true);
    });

    it('複数の変更が同時に発生している場合はtrueを返す', () => {
      const savedState: SavedTabState = {
        dataFileTabs: [{ name: 'メイン', files: ['data.json'] }],
        dataFileLabels: {},
      };
      const currentTabs: DataFileTab[] = [{ name: 'メイン変更後', files: ['data.json'] }];
      const currentLabels = { 'data.json': 'カスタムラベル' };
      const pendingOps: PendingFileOperations = {
        filesToCreate: ['data2.json'],
        filesToDelete: ['data3.json'],
      };

      expect(
        TabStateCalculator.hasUnsavedChanges(savedState, currentTabs, currentLabels, pendingOps)
      ).toBe(true);
    });
  });

  describe('getFileDeletionType', () => {
    it('作成予定のファイルを削除する場合はcancelCreationを返す', () => {
      const updatedTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.json'] }];
      const result = TabStateCalculator.getFileDeletionType(
        'data2.json',
        ['data2.json'],
        updatedTabs
      );
      expect(result).toBe('cancelCreation');
    });

    it('他のタブでも使用されているファイルを削除する場合はremoveFromTabを返す', () => {
      const updatedTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.json'] },
        { name: 'サブ1', files: ['data.json'] },
      ];
      const result = TabStateCalculator.getFileDeletionType('data.json', [], updatedTabs);
      expect(result).toBe('removeFromTab');
    });

    it('他のタブで使用されていないファイルを削除する場合はscheduleDeleteを返す', () => {
      const updatedTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.json'] }];
      const result = TabStateCalculator.getFileDeletionType('data2.json', [], updatedTabs);
      expect(result).toBe('scheduleDelete');
    });

    it('作成予定かつ他のタブでも使用されている場合はcancelCreationを優先', () => {
      const updatedTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data2.json'] },
        { name: 'サブ1', files: ['data2.json'] },
      ];
      const result = TabStateCalculator.getFileDeletionType(
        'data2.json',
        ['data2.json'],
        updatedTabs
      );
      expect(result).toBe('cancelCreation');
    });
  });

  describe('getFilesToDeleteOnTabRemoval', () => {
    it('タブに含まれるファイルが他のタブで使用されていない場合は削除リストに含める', () => {
      const allTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.json'] },
        { name: 'サブ1', files: ['data2.json'] },
      ];
      const result = TabStateCalculator.getFilesToDeleteOnTabRemoval(1, [], allTabs);
      expect(result).toEqual(['data2.json']);
    });

    it('タブに含まれるファイルが他のタブでも使用されている場合は削除リストに含めない', () => {
      const allTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.json'] },
        { name: 'サブ1', files: ['data.json'] },
      ];
      const result = TabStateCalculator.getFilesToDeleteOnTabRemoval(1, [], allTabs);
      expect(result).toEqual([]);
    });

    it('作成予定のファイルは削除リストに含めない', () => {
      const allTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.json'] },
        { name: 'サブ1', files: ['data2.json'] },
      ];
      const result = TabStateCalculator.getFilesToDeleteOnTabRemoval(1, ['data2.json'], allTabs);
      expect(result).toEqual([]);
    });

    it('複数ファイルがあり、一部は他のタブでも使用されている場合', () => {
      const allTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.json'] },
        { name: 'サブ1', files: ['data.json', 'data2.json'] },
      ];
      const result = TabStateCalculator.getFilesToDeleteOnTabRemoval(1, [], allTabs);
      // data.jsonは他のタブでも使用されているため削除しない
      // data2.jsonは他のタブで使用されていないため削除する
      expect(result).toEqual(['data2.json']);
    });

    it('複数ファイルがあり、すべて他のタブでも使用されている場合', () => {
      const allTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.json', 'data2.json'] },
        { name: 'サブ1', files: ['data.json', 'data2.json'] },
      ];
      const result = TabStateCalculator.getFilesToDeleteOnTabRemoval(1, [], allTabs);
      expect(result).toEqual([]);
    });

    it('複数ファイルがあり、すべて他のタブで使用されていない場合', () => {
      const allTabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.json'] },
        { name: 'サブ1', files: ['data2.json', 'data3.json'] },
      ];
      const result = TabStateCalculator.getFilesToDeleteOnTabRemoval(1, [], allTabs);
      expect(result).toEqual(['data2.json', 'data3.json']);
    });

    it('範囲外のタブインデックスの場合は空配列を返す', () => {
      const allTabs: DataFileTab[] = [{ name: 'メイン', files: ['data.json'] }];
      expect(TabStateCalculator.getFilesToDeleteOnTabRemoval(1, [], allTabs)).toEqual([]);
      expect(TabStateCalculator.getFilesToDeleteOnTabRemoval(-1, [], allTabs)).toEqual([]);
    });
  });
});
