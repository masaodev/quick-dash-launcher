import { describe, expect, it } from 'vitest';

import type { AppItem } from '../types';

import { getDeletableItemId } from './launcherItemDelete';

describe('getDeletableItemId', () => {
  it.each<[string, AppItem, string | null]>([
    [
      'ふつうのアイテム',
      { id: 'a1', displayName: 'メモ帳', path: 'notepad.exe', type: 'app' },
      'a1',
    ],
    [
      'フォルダ取込で並んだアイテム',
      {
        displayName: 'a.txt',
        path: 'C:\\docs\\a.txt',
        type: 'file',
        isDirExpanded: true,
        expandedFromId: 'dir1',
      },
      null,
    ],
    [
      'ブックマーク自動取込のアイテム',
      {
        id: 'b1',
        displayName: 'Example',
        path: 'https://example.com',
        type: 'url',
        autoImportRuleId: 'rule1',
      },
      null,
    ],
    ['セット', { id: 's1', type: 'set', displayName: '朝の一式', entries: [] }, 's1'],
    [
      'クリップボード',
      {
        id: 'c1',
        type: 'clipboard',
        displayName: '定型文',
        clipboardDataRef: 'ref',
        formats: ['text'],
        savedAt: 0,
      },
      'c1',
    ],
    ['id の無いアイテム', { displayName: 'x', path: 'x', type: 'file' }, null],
  ])('%s', (_label, item, expected) => {
    expect(getDeletableItemId(item)).toBe(expected);
  });
});
