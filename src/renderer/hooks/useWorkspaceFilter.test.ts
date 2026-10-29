import { afterEach, describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { WorkspaceGroup, WorkspaceItem } from '@common/types';

import { setSearchNormalization } from '../utils/dataParser';

import { useWorkspaceFilter } from './useWorkspaceFilter';

const group = (id: string, displayName: string, parentGroupId?: string) =>
  ({ id, displayName, parentGroupId, workspaceId: 'w', order: 0 }) as WorkspaceGroup;
const item = (id: string, displayName: string, groupId?: string) =>
  ({ id, displayName, groupId, workspaceId: 'w', type: 'item', path: id }) as WorkspaceItem;

const groups = [group('kabu', '株'), group('sub', '月次', 'kabu'), group('work', '仕事')];
const items = [
  item('a', '銘柄選定.xlsm', 'sub'),
  item('b', '信用売却用.xlsx', 'kabu'),
  item('c', '週報.xlsm', 'work'),
  item('d', 'メモ帳'),
];

function visibleItems(filterText: string, scope: 'all' | 'group' | 'item' = 'all') {
  const { result } = renderHook(() => useWorkspaceFilter(groups, items, filterText, scope));
  const { itemVisibility } = result.current;
  return items.filter((i) => itemVisibility?.get(i.id) ?? true).map((i) => i.id);
}

describe('useWorkspaceFilter（スペース区切りの AND）', () => {
  it('アイテム名の語をすべて含むものに絞る', () => {
    expect(visibleItems('週報 xlsm')).toEqual(['c']);
    expect(visibleItems('週報 xlsx')).toEqual([]);
  });

  it('「すべて」では語がグループ名（親を含む）とアイテム名にまたがってよい', () => {
    expect(visibleItems('株 xlsm')).toEqual(['a']);
    expect(visibleItems('月次 銘柄')).toEqual(['a']);
  });

  it('「アイテム」ではグループ名にまたがらない', () => {
    expect(visibleItems('株 xlsm', 'item')).toEqual([]);
    expect(visibleItems('銘柄 xlsm', 'item')).toEqual(['a']);
  });

  it('1 語なら今までと同じ（グループ名に当たればその中のアイテムを出す）', () => {
    expect(visibleItems('株')).toEqual(['a', 'b']);
    expect(visibleItems('メモ')).toEqual(['d']);
  });
});

describe('useWorkspaceFilter（全角・半角、ひらがな・カタカナを区別しない設定）', () => {
  afterEach(() => setSearchNormalization({ ignoreWidth: false, ignoreKana: false }));

  it('既定では区別し、設定をオンにすると全角英数・ひらがなでも当たる', () => {
    expect(visibleItems('ＸＬＳＸ')).toEqual([]);
    expect(visibleItems('めも')).toEqual([]);
    setSearchNormalization({ ignoreWidth: true, ignoreKana: true });
    expect(visibleItems('ＸＬＳＸ')).toEqual(['b']);
    expect(visibleItems('めも')).toEqual(['d']);
  });
});
