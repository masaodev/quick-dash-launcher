import { describe, it, expect } from 'vitest';

import {
  addTab,
  addNewFileToTab,
  addExistingFileToTab,
  deleteTab,
  moveFileInTab,
  moveTab,
  removeFileFromTab,
  renameFile,
  renameTab,
  type TabStructure,
} from '../tabStructureEdits';

const MAIN = 'datafiles/data.json';
const D2 = 'datafiles/data2.json';
const D3 = 'datafiles/data3.json';
const D4 = 'datafiles/data4.json';

/** 本番に近い構成: メイン（data.json＋data4）・ブックマーク全件（data2）・Window（data3） */
function sample(): TabStructure {
  return {
    tabs: [
      { name: 'メイン', files: [MAIN, D4] },
      { name: 'ブックマーク全件', files: [D2] },
      { name: 'Window', files: [D3] },
    ],
    labels: {
      [MAIN]: 'メイン用データファイル',
      [D2]: 'ブックマーク全件用データファイル',
      [D3]: 'Window用データファイル',
      [D4]: 'ブックマーク☆',
    },
  };
}

describe('tabStructureEdits', () => {
  describe('addTab', () => {
    it('末尾にタブを足し、次の番号のデータファイルを作る', () => {
      const result = addTab(sample(), ' 趣味 ', []);
      if (!result.ok) throw new Error(result.reason);
      expect(result.structure.tabs[3]).toEqual({ name: '趣味', files: ['datafiles/data5.json'] });
      expect(result.structure.labels['datafiles/data5.json']).toBe('趣味用データファイル');
      expect(result.filesToCreate).toEqual(['datafiles/data5.json']);
      expect(result.filesToDelete).toEqual([]);
    });

    it('タブに入っていないディスク上のファイルとは重ならない番号にする', () => {
      const result = addTab(sample(), '趣味', ['datafiles/data7.json']);
      if (!result.ok) throw new Error(result.reason);
      expect(result.filesToCreate).toEqual(['datafiles/data8.json']);
    });

    it('名前が空なら既定のタブ名にする', () => {
      const result = addTab(sample(), '  ', []);
      if (!result.ok) throw new Error(result.reason);
      expect(result.structure.tabs[3].name).toBe('サブ4');
    });
  });

  describe('renameTab', () => {
    it('前後の空白を除いて名前を変える', () => {
      const result = renameTab(sample(), 1, ' ブクマ ');
      if (!result.ok) throw new Error(result.reason);
      expect(result.structure.tabs[1].name).toBe('ブクマ');
    });

    it('空の名前は受け付けない', () => {
      expect(renameTab(sample(), 1, ' ').ok).toBe(false);
    });
  });

  describe('moveTab', () => {
    it('隣と入れ替える', () => {
      const result = moveTab(sample(), 1, 1);
      if (!result.ok) throw new Error(result.reason);
      expect(result.structure.tabs.map((t) => t.name)).toEqual([
        'メイン',
        'Window',
        'ブックマーク全件',
      ]);
    });

    it('端からは動かせない', () => {
      expect(moveTab(sample(), 0, -1).ok).toBe(false);
      expect(moveTab(sample(), 2, 1).ok).toBe(false);
    });
  });

  describe('deleteTab', () => {
    it('ほかで使っていないデータファイルも消す', () => {
      const result = deleteTab(sample(), 1);
      if (!result.ok) throw new Error(result.reason);
      expect(result.structure.tabs.map((t) => t.name)).toEqual(['メイン', 'Window']);
      expect(result.filesToDelete).toEqual([D2]);
      expect(result.structure.labels[D2]).toBeUndefined();
    });

    it('ほかのタブでも使っているデータファイルは消さない', () => {
      const structure = sample();
      structure.tabs[2].files.push(D2);
      const result = deleteTab(structure, 1);
      if (!result.ok) throw new Error(result.reason);
      expect(result.filesToDelete).toEqual([]);
      expect(result.structure.labels[D2]).toBe('ブックマーク全件用データファイル');
    });

    it('data.json が入っている唯一のタブは消せない', () => {
      expect(deleteTab(sample(), 0).ok).toBe(false);
    });

    it('ほかのタブにも data.json があれば消せる（data.json は残す）', () => {
      const structure = sample();
      structure.tabs[2].files.push(MAIN);
      const result = deleteTab(structure, 0);
      if (!result.ok) throw new Error(result.reason);
      expect(result.filesToDelete).toEqual([D4]);
    });

    it('最後の 1 つのタブは消せない', () => {
      const structure: TabStructure = { tabs: [{ name: 'サブ', files: [D2] }], labels: {} };
      expect(deleteTab(structure, 0).ok).toBe(false);
    });
  });

  describe('addNewFileToTab', () => {
    it('新しいデータファイルを作ってタブの末尾に入れる', () => {
      const result = addNewFileToTab(sample(), 2, []);
      if (!result.ok) throw new Error(result.reason);
      expect(result.structure.tabs[2].files).toEqual([D3, 'datafiles/data5.json']);
      expect(result.structure.labels['datafiles/data5.json']).toBe('Window用データファイル2');
      expect(result.filesToCreate).toEqual(['datafiles/data5.json']);
    });
  });

  describe('addExistingFileToTab', () => {
    it('既存のファイルを入れる。名前は変えない', () => {
      const result = addExistingFileToTab(sample(), 2, D4);
      if (!result.ok) throw new Error(result.reason);
      expect(result.structure.tabs[2].files).toEqual([D3, D4]);
      expect(result.structure.labels[D4]).toBe('ブックマーク☆');
      expect(result.filesToCreate).toEqual([]);
    });

    it('名前の無いファイルには既定の名前を付ける', () => {
      const result = addExistingFileToTab(sample(), 2, 'datafiles/data9.json');
      if (!result.ok) throw new Error(result.reason);
      expect(result.structure.labels['datafiles/data9.json']).toBe('Window用データファイル2');
    });

    it('すでに入っているファイルは入れられない', () => {
      expect(addExistingFileToTab(sample(), 0, D4).ok).toBe(false);
    });
  });

  describe('renameFile', () => {
    it('名前を変える。空は受け付けない', () => {
      const result = renameFile(sample(), D4, ' お気に入り ');
      if (!result.ok) throw new Error(result.reason);
      expect(result.structure.labels[D4]).toBe('お気に入り');
      expect(renameFile(sample(), D4, '').ok).toBe(false);
    });
  });

  describe('moveFileInTab', () => {
    it('タブの中で隣と入れ替える', () => {
      const result = moveFileInTab(sample(), 0, D4, -1);
      if (!result.ok) throw new Error(result.reason);
      expect(result.structure.tabs[0].files).toEqual([D4, MAIN]);
      expect(moveFileInTab(sample(), 0, D4, 1).ok).toBe(false);
    });
  });

  describe('removeFileFromTab', () => {
    it('どこでも使わなくなるファイルはディスクからも消す', () => {
      const result = removeFileFromTab(sample(), 0, D4);
      if (!result.ok) throw new Error(result.reason);
      expect(result.structure.tabs[0].files).toEqual([MAIN]);
      expect(result.filesToDelete).toEqual([D4]);
      expect(result.structure.labels[D4]).toBeUndefined();
    });

    it('ほかのタブでも使っているファイルは外すだけ', () => {
      const structure = sample();
      structure.tabs[2].files.push(D4);
      const result = removeFileFromTab(structure, 0, D4);
      if (!result.ok) throw new Error(result.reason);
      expect(result.filesToDelete).toEqual([]);
      expect(result.structure.labels[D4]).toBe('ブックマーク☆');
    });

    it('タブの最後の 1 ファイルは外せない', () => {
      expect(removeFileFromTab(sample(), 1, D2).ok).toBe(false);
    });

    it('data.json はほかのタブに無ければ外せない', () => {
      expect(removeFileFromTab(sample(), 0, MAIN).ok).toBe(false);
    });
  });
});
