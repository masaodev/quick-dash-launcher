import { describe, it, expect } from 'vitest';
import { DataFileTab } from '@common/types';

import { FileNameGenerator } from '../fileNameGenerator';

describe('FileNameGenerator', () => {
  describe('getDefaultTabName', () => {
    it('data.txtの場合は「メイン」を返す', () => {
      expect(FileNameGenerator.getDefaultTabName('data.txt')).toBe('メイン');
    });

    it('data2.txtの場合は「サブ1」を返す', () => {
      expect(FileNameGenerator.getDefaultTabName('data2.txt')).toBe('サブ1');
    });

    it('data3.txtの場合は「サブ2」を返す', () => {
      expect(FileNameGenerator.getDefaultTabName('data3.txt')).toBe('サブ2');
    });

    it('data10.txtの場合は「サブ9」を返す', () => {
      expect(FileNameGenerator.getDefaultTabName('data10.txt')).toBe('サブ9');
    });

    it('パターンに一致しないファイル名の場合はそのまま返す', () => {
      expect(FileNameGenerator.getDefaultTabName('custom.txt')).toBe('custom.txt');
      expect(FileNameGenerator.getDefaultTabName('data.csv')).toBe('data.csv');
    });
  });

  describe('getDefaultFileLabel', () => {
    it('タブ名が指定されている場合は「タブ名用データファイル」を返す', () => {
      expect(FileNameGenerator.getDefaultFileLabel('data.txt', 'メイン')).toBe(
        'メイン用データファイル'
      );
      expect(FileNameGenerator.getDefaultFileLabel('data2.txt', 'サブ1')).toBe(
        'サブ1用データファイル'
      );
    });

    it('タブ名が未指定でtabsが指定されている場合は紐づくタブ名を使用', () => {
      const tabs: DataFileTab[] = [
        { name: 'メイン', files: ['data.txt'] },
        { name: 'サブ1', files: ['data2.txt'] },
      ];

      expect(FileNameGenerator.getDefaultFileLabel('data.txt', undefined, tabs)).toBe(
        'メイン用データファイル'
      );
      expect(FileNameGenerator.getDefaultFileLabel('data2.txt', undefined, tabs)).toBe(
        'サブ1用データファイル'
      );
    });

    it('タブ名もtabsも未指定の場合はファイル名からタブ名を生成', () => {
      expect(FileNameGenerator.getDefaultFileLabel('data.txt')).toBe('メイン用データファイル');
      expect(FileNameGenerator.getDefaultFileLabel('data2.txt')).toBe('サブ1用データファイル');
    });

    it('ファイルがどのタブにも紐づいていない場合はファイル名からタブ名を生成', () => {
      const tabs: DataFileTab[] = [{ name: 'メイン', files: ['data.txt'] }];

      expect(FileNameGenerator.getDefaultFileLabel('data3.txt', undefined, tabs)).toBe(
        'サブ2用データファイル'
      );
    });
  });

  describe('getNextAvailableFileName', () => {
    it('既存ファイルがdata.txtのみの場合はdata2.txtを返す', () => {
      expect(FileNameGenerator.getNextAvailableFileName(['data.txt'], [])).toBe('data2.txt');
    });

    it('既存ファイルがdata.txt, data2.txtの場合はdata3.txtを返す', () => {
      expect(FileNameGenerator.getNextAvailableFileName(['data.txt', 'data2.txt'], [])).toBe(
        'data3.txt'
      );
    });

    it('欠番がある場合は欠番を埋めずに次の番号を返す', () => {
      expect(FileNameGenerator.getNextAvailableFileName(['data.txt', 'data3.txt'], [])).toBe(
        'data4.txt'
      );
    });

    it('作成予定のファイルも考慮する', () => {
      expect(FileNameGenerator.getNextAvailableFileName(['data.txt'], ['data2.txt'])).toBe(
        'data3.txt'
      );
    });

    it('大きな番号のファイルがある場合はその次の番号を返す', () => {
      expect(FileNameGenerator.getNextAvailableFileName(['data.txt', 'data10.txt'], [])).toBe(
        'data11.txt'
      );
    });

    it('既存ファイルが空の場合はdata2.txtを返す', () => {
      expect(FileNameGenerator.getNextAvailableFileName([], [])).toBe('data2.txt');
    });

    it('大文字小文字を区別せずにパターンマッチ', () => {
      expect(FileNameGenerator.getNextAvailableFileName(['DATA.TXT', 'Data2.TXT'], [])).toBe(
        'data3.txt'
      );
    });
  });

  describe('generateUniqueLabel', () => {
    it('既存ラベルに存在しない場合はそのまま返す', () => {
      const existingLabels = new Set<string>();
      expect(FileNameGenerator.generateUniqueLabel('メイン用データファイル', existingLabels)).toBe(
        'メイン用データファイル'
      );
    });

    it('既存ラベルに存在する場合は番号を付ける', () => {
      const existingLabels = new Set(['メイン用データファイル']);
      expect(FileNameGenerator.generateUniqueLabel('メイン用データファイル', existingLabels)).toBe(
        'メイン用データファイル2'
      );
    });

    it('番号付きラベルが既に存在する場合は次の番号を付ける', () => {
      const existingLabels = new Set(['メイン用データファイル', 'メイン用データファイル2']);
      expect(FileNameGenerator.generateUniqueLabel('メイン用データファイル', existingLabels)).toBe(
        'メイン用データファイル3'
      );
    });

    it('複数の番号付きラベルが存在する場合は最小の空き番号を使用', () => {
      const existingLabels = new Set([
        'メイン用データファイル',
        'メイン用データファイル2',
        'メイン用データファイル3',
      ]);
      expect(FileNameGenerator.generateUniqueLabel('メイン用データファイル', existingLabels)).toBe(
        'メイン用データファイル4'
      );
    });
  });
});
