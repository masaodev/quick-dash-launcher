import { describe, it, expect } from 'vitest';

import type { JsonItem } from '../types';

import { findSetNamesUsingItems } from './setUsage';

const items: JsonItem[] = [
  { id: 'np000001', type: 'item', displayName: 'メモ帳', path: 'notepad.exe' },
  { id: 'cl000001', type: 'item', displayName: '電卓', path: 'calc.exe' },
  { id: 'st000001', type: 'set', displayName: '朝の準備', entries: [{ itemId: 'np000001' }] },
  {
    id: 'st000002',
    type: 'set',
    displayName: '仕事',
    entries: [{ itemId: 'np000001' }, { itemId: 'cl000001' }],
  },
  {
    id: 'st000003',
    type: 'set',
    displayName: 'サイト',
    entries: [{ open: { path: 'https://example.com' } }],
  },
  { id: 'st000004', type: 'set', displayName: '夜', entries: [{ itemId: 'np000001' }] },
];

describe('findSetNamesUsingItems（A3-79 #6）', () => {
  it('行でアイテムを指しているセットの名前を返す', () => {
    expect(findSetNamesUsingItems(items, ['cl000001'])).toEqual(['仕事']);
    expect(findSetNamesUsingItems(items, ['np000001'])).toEqual(['朝の準備', '仕事', '夜']);
  });

  it('一緒に消すセットは数えない。使われていなければ空', () => {
    expect(findSetNamesUsingItems(items, ['cl000001', 'st000002'])).toEqual([]);
    expect(findSetNamesUsingItems(items, ['st000003'])).toEqual([]);
  });
});
