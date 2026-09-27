import { describe, it, expect } from 'vitest';
import type { JsonItem } from '@common/types';

import {
  ITEM_TYPE_INFO,
  formatUpdatedAt,
  getEditablePath,
  hasDisplayName,
  isPathEditable,
  withEditedPath,
} from './adminItemDisplay';

const item: JsonItem = { id: 'a1', type: 'item', displayName: 'a', path: 'C:\\a' };
const dir: JsonItem = { id: 'd1', type: 'dir', path: 'C:\\dir' };
const group: JsonItem = { id: 'g1', type: 'group', displayName: 'G', itemNames: ['a'] };

describe('adminItemDisplay', () => {
  it('種類ごとの表示名が揃っていること', () => {
    expect(Object.keys(ITEM_TYPE_INFO).sort()).toEqual(
      ['clipboard', 'dir', 'group', 'item', 'layout', 'window'].sort()
    );
    expect(ITEM_TYPE_INFO.layout.name).toBe('ウィンドウ配置');
  });

  it('hasDisplayName はフォルダ取込だけ false になること', () => {
    expect(hasDisplayName(item)).toBe(true);
    expect(hasDisplayName(group)).toBe(true);
    expect(hasDisplayName(dir)).toBe(false);
  });

  it('パスをセルで編集できるのは単一アイテムとフォルダ取込だけであること', () => {
    expect(isPathEditable(item)).toBe(true);
    expect(isPathEditable(dir)).toBe(true);
    expect(isPathEditable(group)).toBe(false);
    expect(getEditablePath(item)).toBe('C:\\a');
    expect(getEditablePath(dir)).toBe('C:\\dir');
    expect(getEditablePath(group)).toBe('');
  });

  it('withEditedPath は編集できる種類だけパスを差し替えること', () => {
    expect(withEditedPath(item, 'C:\\b')).toMatchObject({ id: 'a1', path: 'C:\\b' });
    expect(withEditedPath(dir, 'C:\\e')).toMatchObject({ id: 'd1', path: 'C:\\e' });
    expect(withEditedPath(group, 'x')).toBe(group);
  });

  it('formatUpdatedAt は未設定なら "-" を返すこと', () => {
    expect(formatUpdatedAt(undefined)).toBe('-');
    expect(formatUpdatedAt(0)).toBe('-');
    expect(formatUpdatedAt(Date.UTC(2026, 0, 2, 3, 4))).toMatch(/2026/);
  });
});
