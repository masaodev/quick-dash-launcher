import { describe, expect, it } from 'vitest';
import type { JsonItem } from '@common/types';

import { parseCsv, stringifyCsv } from './csv';
import { toEditableItem } from './editableItemOperations';
import { applyCsvImportPlan, itemsToCsv, planCsvImport } from './itemCsv';

const MAIN = 'datafiles/data.json';
const SUB = 'datafiles/data2.json';
const FILES = [MAIN, SUB];

const github = toEditableItem(
  {
    id: 'gh000001',
    type: 'item',
    displayName: 'GitHub',
    path: 'https://github.com',
    memo: '1 行目\n2 行目, "引用"',
  } as JsonItem,
  MAIN
);
const tools = toEditableItem({ id: 'dir00001', type: 'dir', path: 'C:\\tools' } as JsonItem, SUB);
const items = [github, tools];

describe('csv', () => {
  it('カンマ・引用符・改行を含む値を往復できる', () => {
    const rows = [
      ['a', 'b,c', 'd"e', 'f\r\ng'],
      ['', ' x', 'y'],
    ];
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows);
  });

  it('BOM を除き、LF だけの改行も読む', () => {
    expect(parseCsv('\uFEFFa,b\nc,d\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('itemsToCsv', () => {
  it('見出しと、ファイルの順に各アイテムの行を書く', () => {
    const rows = parseCsv(itemsToCsv(items, FILES));
    expect(rows[0]).toEqual([
      'id',
      'dataFile',
      'type',
      'displayName',
      'path',
      'args',
      'memo',
      'updatedAt',
    ]);
    expect(rows[1].slice(0, 7)).toEqual([
      'gh000001',
      MAIN,
      'item',
      'GitHub',
      'https://github.com',
      '',
      '1 行目\n2 行目, "引用"',
    ]);
    expect(rows[2].slice(0, 5)).toEqual(['dir00001', SUB, 'dir', '', 'C:\\tools']);
  });
});

describe('planCsvImport', () => {
  const csv = (...lines: string[][]) =>
    stringifyCsv([['id', 'dataFile', 'type', 'displayName', 'path', 'args', 'memo'], ...lines]);

  it('書き出したままの CSV は「変化なし」', () => {
    const plan = planCsvImport(itemsToCsv(items, FILES), items, FILES, MAIN);
    expect(plan).toMatchObject({ updates: [], additions: [], unchangedCount: 2, errors: [] });
  });

  it('id の一致する行は名前・パス・引数・メモを変え、空のメモ・引数は項目ごと消す', () => {
    const plan = planCsvImport(
      csv(['gh000001', MAIN, 'item', 'GitHub2', 'https://github.com/x', '-a', '']),
      items,
      FILES,
      MAIN
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].after).toEqual({
      id: 'gh000001',
      type: 'item',
      displayName: 'GitHub2',
      path: 'https://github.com/x',
      args: '-a',
    });
  });

  it('CSV に無い列は変えない', () => {
    const plan = planCsvImport(
      stringifyCsv([
        ['id', 'displayName'],
        ['gh000001', '改名'],
      ]),
      items,
      FILES,
      MAIN
    );
    expect(plan.updates[0].after).toMatchObject({ displayName: '改名', memo: github.item.memo });
  });

  it('id の空の行は新しいアイテムにし、データファイルが空なら既定のファイルに入れる', () => {
    const plan = planCsvImport(
      csv(['', '', '', 'メモ帳', 'notepad.exe', '', 'メモ'], ['', SUB, 'dir', '', 'D:\\x', '', '']),
      items,
      FILES,
      MAIN
    );
    expect(plan.errors).toEqual([]);
    expect(plan.additions.map((a) => [a.dataFile, a.item.type])).toEqual([
      [MAIN, 'item'],
      [SUB, 'dir'],
    ]);
    expect(plan.additions[0].item).toMatchObject({ displayName: 'メモ帳', memo: 'メモ' });
    expect(plan.additions[0].item.id).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  it('おかしな行はエラーにして飛ばし、ほかの行は取り込む', () => {
    const plan = planCsvImport(
      csv(
        ['nothere1', MAIN, 'item', 'x', 'y', '', ''],
        ['gh000001', MAIN, 'item', '', 'https://github.com', '', ''],
        ['', MAIN, 'set', 'セット', 'x', '', ''],
        ['', 'datafiles/none.json', 'item', 'a', 'b', '', ''],
        ['', MAIN, 'item', '名前だけ', '', '', ''],
        ['dir00001', SUB, 'dir', '', 'C:\\tools2', '', ''],
        ['dir00001', SUB, 'dir', '', 'C:\\tools3', '', '']
      ),
      items,
      FILES,
      MAIN
    );
    expect(plan.errors.map((e) => [e.line, e.code])).toEqual([
      [2, 'notFound'],
      [3, 'nameRequired'],
      [4, 'typeNotAddable'],
      [5, 'unknownDataFile'],
      [6, 'pathRequired'],
      [8, 'duplicateId'],
    ]);
    expect(plan.updates.map((u) => u.after)).toEqual([
      { id: 'dir00001', type: 'dir', path: 'C:\\tools2' },
    ]);
  });

  it('セルの中の改行が CRLF でも、メモは LF にそろえる', () => {
    const plan = planCsvImport(
      stringifyCsv([
        ['id', 'memo'],
        ['gh000001', 'a\r\nb\r\n'],
      ]),
      items,
      FILES,
      MAIN
    );
    expect(plan.updates[0].after.memo).toBe('a\nb');
  });

  it('id の列が無ければ取り込まない', () => {
    const plan = planCsvImport(stringifyCsv([['name'], ['x']]), items, FILES, MAIN);
    expect(plan.errors).toEqual([{ line: 1, code: 'noIdColumn' }]);
  });
});

describe('applyCsvImportPlan', () => {
  it('変えた行は差し替え、足す行はそのファイルの先頭に置き、CSV に無い行は残す', () => {
    const plan = planCsvImport(
      stringifyCsv([
        ['id', 'displayName', 'path'],
        ['gh000001', 'GitHub2', 'https://github.com'],
        ['', '新しい', 'C:\\new.exe'],
      ]),
      items,
      FILES,
      MAIN
    );
    const next = applyCsvImportPlan(items, plan);
    expect(
      next.map((e) => [
        e.meta.sourceFile,
        'displayName' in e.item ? e.item.displayName : e.item.type,
      ])
    ).toEqual([
      [MAIN, '新しい'],
      [MAIN, 'GitHub2'],
      [SUB, 'dir'],
    ]);
  });
});
