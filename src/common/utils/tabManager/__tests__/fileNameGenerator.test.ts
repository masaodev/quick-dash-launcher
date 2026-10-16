import { describe, it, expect } from 'vitest';
import { DataFileTab } from '@common/types';

import { FileNameGenerator } from '../fileNameGenerator';

describe('FileNameGenerator', () => {
  describe('getDefaultTabName', () => {
    it('data.jsonの場合は「メイン」を返す', () => {
      expect(FileNameGenerator.getDefaultTabName('datafiles/data.json')).toBe('メイン');
    });

    it('data2.jsonの場合は「サブ1」を返す', () => {
      expect(FileNameGenerator.getDefaultTabName('datafiles/data2.json')).toBe('サブ1');
    });

    it('data3.jsonの場合は「サブ2」を返す', () => {
      expect(FileNameGenerator.getDefaultTabName('datafiles/data3.json')).toBe('サブ2');
    });

    it('data10.jsonの場合は「サブ9」を返す', () => {
      expect(FileNameGenerator.getDefaultTabName('datafiles/data10.json')).toBe('サブ9');
    });

    it('パターンに一致しないファイル名の場合はそのまま返す', () => {
      expect(FileNameGenerator.getDefaultTabName('custom.txt')).toBe('custom.txt');
      expect(FileNameGenerator.getDefaultTabName('custom.xml')).toBe('custom.xml');
    });
  });

  describe('getDefaultFileLabel', () => {
    it('タブ名が指定されている場合は「タブ名用データファイル」を返す', () => {
      expect(FileNameGenerator.getDefaultFileLabel('datafiles/data.json', 'メイン')).toBe(
        'メイン用データファイル'
      );
      expect(FileNameGenerator.getDefaultFileLabel('datafiles/data2.json', 'サブ1')).toBe(
        'サブ1用データファイル'
      );
    });

    it('タブ名が未指定でtabsが指定されている場合は紐づくタブ名を使用', () => {
      const tabs: DataFileTab[] = [
        { name: 'メイン', files: ['datafiles/data.json'] },
        { name: 'サブ1', files: ['datafiles/data2.json'] },
      ];

      expect(FileNameGenerator.getDefaultFileLabel('datafiles/data.json', undefined, tabs)).toBe(
        'メイン用データファイル'
      );
      expect(FileNameGenerator.getDefaultFileLabel('datafiles/data2.json', undefined, tabs)).toBe(
        'サブ1用データファイル'
      );
    });

    it('タブ名もtabsも未指定の場合はファイル名からタブ名を生成', () => {
      expect(FileNameGenerator.getDefaultFileLabel('datafiles/data.json')).toBe(
        'メイン用データファイル'
      );
      expect(FileNameGenerator.getDefaultFileLabel('datafiles/data2.json')).toBe(
        'サブ1用データファイル'
      );
    });

    it('ファイルがどのタブにも紐づいていない場合はファイル名からタブ名を生成', () => {
      const tabs: DataFileTab[] = [{ name: 'メイン', files: ['datafiles/data.json'] }];

      expect(FileNameGenerator.getDefaultFileLabel('datafiles/data3.json', undefined, tabs)).toBe(
        'サブ2用データファイル'
      );
    });
  });

  describe('getNextAvailableFileName', () => {
    it('既存ファイルがdata.jsonのみの場合はdata2.jsonを返す', () => {
      expect(FileNameGenerator.getNextAvailableFileName(['datafiles/data.json'], [])).toBe(
        'datafiles/data2.json'
      );
    });

    it('既存ファイルがdata.json, data2.jsonの場合はdata3.jsonを返す', () => {
      expect(
        FileNameGenerator.getNextAvailableFileName(
          ['datafiles/data.json', 'datafiles/data2.json'],
          []
        )
      ).toBe('datafiles/data3.json');
    });

    it('欠番がある場合は欠番を埋めずに次の番号を返す', () => {
      expect(
        FileNameGenerator.getNextAvailableFileName(
          ['datafiles/data.json', 'datafiles/data3.json'],
          []
        )
      ).toBe('datafiles/data4.json');
    });

    it('作成予定のファイルも考慮する', () => {
      expect(
        FileNameGenerator.getNextAvailableFileName(
          ['datafiles/data.json'],
          ['datafiles/data2.json']
        )
      ).toBe('datafiles/data3.json');
    });

    it('大きな番号のファイルがある場合はその次の番号を返す', () => {
      expect(
        FileNameGenerator.getNextAvailableFileName(
          ['datafiles/data.json', 'datafiles/data10.json'],
          []
        )
      ).toBe('datafiles/data11.json');
    });

    it('既存ファイルが空の場合はdata2.jsonを返す', () => {
      expect(FileNameGenerator.getNextAvailableFileName([], [])).toBe('datafiles/data2.json');
    });

    it('大文字小文字を区別せずにパターンマッチ', () => {
      expect(
        FileNameGenerator.getNextAvailableFileName(
          ['datafiles/DATA.JSON', 'datafiles/Data2.JSON'],
          []
        )
      ).toBe('datafiles/data3.json');
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
