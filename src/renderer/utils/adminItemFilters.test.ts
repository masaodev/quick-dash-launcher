import { describe, expect, it } from 'vitest';
import type { JsonItem } from '@common/types';
import type { EditableJsonItem, PathExistenceStatus } from '@common/types/editableItem';

import {
  activeFilterColumns,
  matchesColumnFilters,
  typeFilterKeyOf,
  type ColumnFilters,
} from './adminItemFilters';
import { toEditableItem } from './editableItemOperations';

const FILE = 'datafiles/data.json';
const NOW = Date.UTC(2026, 9, 21);
const DAY = 24 * 60 * 60 * 1000;

const item = (json: Partial<JsonItem> & { type: JsonItem['type'] }, id = 'x') =>
  toEditableItem({ id, ...json } as JsonItem, FILE);

const github = item(
  {
    type: 'item',
    displayName: 'GitHub',
    path: 'https://github.com',
    memo: '仕事用',
    autoImportRuleId: 'rule1',
    updatedAt: NOW - 2 * DAY,
  },
  'a'
);
const notepad = item(
  { type: 'item', displayName: 'メモ帳', path: 'notepad.exe', updatedAt: NOW - 400 * DAY },
  'b'
);
const tools = item({ type: 'dir', path: 'C:\\tools' }, 'c');
const set = item({ type: 'set', displayName: '朝の準備', entries: [] }, 'd');

const linkStatus: Record<string, PathExistenceStatus> = { c: 'missing' };
const context = {
  linkStatusOf: (e: EditableJsonItem) => linkStatus[e.item.id],
  now: NOW,
};
const pick = (filters: ColumnFilters) =>
  [github, notepad, tools, set]
    .filter((e) => matchesColumnFilters(e, filters, context))
    .map((e) => e.item.id);

describe('typeFilterKeyOf', () => {
  it('単一アイテムは URL とそれ以外に分け、ほかは種類のまま', () => {
    expect(typeFilterKeyOf(github)).toBe('itemUrl');
    expect(typeFilterKeyOf(notepad)).toBe('itemOther');
    expect(typeFilterKeyOf(tools)).toBe('dir');
    expect(typeFilterKeyOf(set)).toBe('set');
  });
});

describe('matchesColumnFilters', () => {
  it('条件が無ければすべて通す', () => {
    expect(pick({})).toEqual(['a', 'b', 'c', 'd']);
  });

  it('種類は選んだものだけ。空の選択は絞り込まない', () => {
    expect(pick({ type: ['itemUrl', 'dir'] })).toEqual(['a', 'c']);
    expect(pick({ type: [] })).toEqual(['a', 'b', 'c', 'd']);
  });

  it('文字の列は「含む」（大文字小文字を区別しない）・空・空でないで絞る', () => {
    expect(pick({ name: { mode: 'contains', text: 'git' } })).toEqual(['a']);
    expect(pick({ pathAndArgs: { mode: 'contains', text: 'TOOLS' } })).toEqual(['c']);
    expect(pick({ memo: { mode: 'nonEmpty' } })).toEqual(['a']);
    expect(pick({ memo: { mode: 'empty' } })).toEqual(['b', 'c', 'd']);
  });

  it('取込元は手動・自動・ルールで絞る', () => {
    expect(pick({ source: 'auto-import-only' })).toEqual(['a']);
    expect(pick({ source: 'manual-only' })).toEqual(['b', 'c', 'd']);
    expect(pick({ source: 'rule1' })).toEqual(['a']);
    expect(pick({ source: 'rule2' })).toEqual([]);
  });

  it('リンクは確認の結果で絞る', () => {
    expect(pick({ link: 'missing' })).toEqual(['c']);
  });

  it('更新日は期間で絞り、「日付なし」は更新日の無い行', () => {
    expect(pick({ updatedAt: 'within7' })).toEqual(['a']);
    expect(pick({ updatedAt: 'olderThan365' })).toEqual(['b']);
    expect(pick({ updatedAt: 'none' })).toEqual(['c', 'd']);
  });

  it('複数の条件は AND', () => {
    expect(pick({ type: ['itemUrl', 'itemOther'], memo: { mode: 'empty' } })).toEqual(['b']);
  });
});

describe('activeFilterColumns', () => {
  it('意味のある条件だけを列の順に返す', () => {
    expect(
      activeFilterColumns({
        updatedAt: 'none',
        type: [],
        name: { mode: 'contains', text: '  ' },
        memo: { mode: 'empty' },
      })
    ).toEqual(['memo', 'updatedAt']);
  });
});
