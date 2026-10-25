import { describe, expect, it } from 'vitest';
import type { JsonItem } from '@common/types';

import { parseCsv, parseCsvDetailed, stringifyCsv } from './csv';
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
  it('引用符が閉じないまま終わったら、引用符を開いた行の番号を返す', () => {
    expect(parseCsvDetailed('a,b\r\nc,"d\r\ne,f\r\n').unclosedQuoteRow).toBe(2);
    expect(parseCsvDetailed('a,"b\r\nc"\r\n').unclosedQuoteRow).toBeUndefined();
  });

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
    expect(plan).toMatchObject({
      updates: [],
      additions: [],
      unchangedCount: 2,
      errors: [],
      ignored: [],
    });
  });

  it('見出しより列が少ない行は、足りない列を変えない', () => {
    const withArgs = toEditableItem(
      {
        id: 'ar000001',
        type: 'item',
        displayName: 'A',
        path: 'a.exe',
        args: '-x',
        memo: 'メモ',
      } as JsonItem,
      MAIN
    );
    const plan = planCsvImport(
      csv(['ar000001', MAIN, 'item', 'A2', 'a.exe']),
      [withArgs],
      FILES,
      MAIN
    );
    expect(plan.updates.map((u) => u.after)).toEqual([
      { id: 'ar000001', type: 'item', displayName: 'A2', path: 'a.exe', args: '-x', memo: 'メモ' },
    ]);
  });

  it('引用符が閉じないまま終わった CSV は、何も取り込まない', () => {
    const text =
      csv().trimEnd() +
      '\r\ngh000001,,,"GitHub2\r\n' +
      csv(['', '', '', '新しい', 'a.exe', '', '']);
    expect(planCsvImport(text, items, FILES, MAIN)).toMatchObject({
      updates: [],
      additions: [],
      errors: [{ line: 2, code: 'unclosedQuote' }],
    });
  });

  it('名前・パス・引数を制御文字を含む値に変える行は取り込まない（メモの改行はよい）', () => {
    const plan = planCsvImport(
      csv(
        ['gh000001', MAIN, 'item', 'Git\nHub', 'https://github.com', '', ''],
        ['dir00001', SUB, 'dir', '', 'C:\\to\tols', '', ''],
        ['', '', '', '新しい', 'a.exe', '-a\n-b', ''],
        ['', '', '', 'メモに改行', 'b.exe', '', '1 行目\n2 行目']
      ),
      items,
      FILES,
      MAIN
    );
    expect(plan.errors.map((e) => [e.line, e.code])).toEqual([
      [2, 'controlChars'],
      [3, 'controlChars'],
      [4, 'controlChars'],
    ]);
    expect(plan.additions.map((a) => a.item.memo)).toEqual(['1 行目\n2 行目']);
  });

  it('今の値がもとから制御文字を含むなら、その列を変えなくてもエラーにしない', () => {
    const tabbed = toEditableItem(
      { id: 'tb000001', type: 'item', displayName: 'a\tb', path: 'a.exe' } as JsonItem,
      MAIN
    );
    const plan = planCsvImport(
      csv(['tb000001', MAIN, 'item', 'a\tb', 'a.exe', '', 'メモ']),
      [tabbed],
      FILES,
      MAIN
    );
    expect(plan.errors).toEqual([]);
    expect(plan.updates).toHaveLength(1);
  });

  it('種別・データファイルの書き換えと、種別に無い列の値は捨てて ignored で知らせる', () => {
    const set = toEditableItem(
      { id: 'st000001', type: 'set', displayName: 'セット', entries: [] } as unknown as JsonItem,
      MAIN
    );
    const plan = planCsvImport(
      csv(
        ['gh000001', SUB, 'dir', 'GitHub2', 'https://github.com', '', '1 行目\n2 行目, "引用"'],
        ['dir00001', SUB, 'dir', 'ツール', 'C:\\tools', '-x', ''],
        ['st000001', MAIN, 'set', 'セット', 'a.exe', '', ''],
        ['', SUB, 'dir', '名前', 'D:\\x', '', '']
      ),
      [...items, set],
      FILES,
      MAIN
    );
    expect(plan.errors).toEqual([]);
    expect(plan.ignored).toEqual([
      { line: 2, name: 'GitHub', columns: ['type', 'dataFile'] },
      { line: 3, name: 'C:\\tools', columns: ['displayName', 'args'] },
      { line: 4, name: 'セット', columns: ['path'] },
      { line: 5, name: 'D:\\x', columns: ['displayName'] },
    ]);
    // ほかの列は取り込む（名前は変わり、種別・データファイルは元のまま）
    expect(
      plan.updates.map((u) => [
        u.before.meta.sourceFile,
        u.after.type,
        'displayName' in u.after && u.after.displayName,
      ])
    ).toEqual([[MAIN, 'item', 'GitHub2']]);
    expect(plan.unchangedCount).toBe(2);
    expect(plan.additions).toHaveLength(1);
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

  it("= + - @ で始まる値は Excel が数式と読まないよう ' を付けて書き、取り込むときに外す", () => {
    const args = toEditableItem(
      {
        id: 'ar000001',
        type: 'item',
        displayName: '=名前',
        path: 'chrome.exe',
        args: '--incognito',
      } as JsonItem,
      MAIN
    );
    const csv = itemsToCsv([args], FILES);
    expect(parseCsv(csv)[1].slice(3, 6)).toEqual(["'=名前", 'chrome.exe', "'--incognito"]);
    expect(planCsvImport(csv, [args], FILES, MAIN)).toMatchObject({
      updates: [],
      unchangedCount: 1,
    });
  });

  it("もとから ' で始まる値は、書き出して取り込み直しても ' が残る", () => {
    const memo = toEditableItem(
      {
        id: 'ap000001',
        type: 'item',
        displayName: "'abc",
        path: 'chrome.exe',
        args: "'=foo",
        memo: "'-- old config",
      } as JsonItem,
      MAIN
    );
    const csv = itemsToCsv([memo], FILES);
    expect(parseCsv(csv)[1].slice(3, 7)).toEqual([
      "'abc",
      'chrome.exe',
      "''=foo",
      "''-- old config",
    ]);
    expect(planCsvImport(csv, [memo], FILES, MAIN)).toMatchObject({
      updates: [],
      unchangedCount: 1,
    });
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
