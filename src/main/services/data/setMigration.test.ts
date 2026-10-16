import { describe, it, expect } from 'vitest';
import type { AppItem } from '@common/types';

import { buildGroupNameResolver, convertLegacySetItems, hasLegacySetItems } from './setMigration';

describe('setMigration', () => {
  const items: AppItem[] = [
    { id: 'a1a1a1a1', type: 'url', displayName: 'Gmail', path: 'https://mail.google.com/' },
    {
      type: 'file',
      displayName: 'メモ.txt',
      path: 'C:\\docs\\メモ.txt',
      isDirExpanded: true,
    },
    // ウィンドウ操作は読み込みでパスの無い単一アイテムになっている（id は変わらない）
    {
      id: 'w1w1w1w1',
      type: 'windowSwitch',
      displayName: '電卓を前面に',
      path: '',
      window: { title: '電卓' },
    },
  ];

  it('名前から id（展開分はパス）を引く', () => {
    const resolve = buildGroupNameResolver(items);
    expect(resolve('Gmail')).toEqual({ itemId: 'a1a1a1a1' });
    expect(resolve('メモ.txt')).toEqual({ open: { path: 'C:\\docs\\メモ.txt' } });
    expect(resolve('電卓を前面に')).toEqual({ itemId: 'w1w1w1w1' });
    expect(resolve('無い')).toBeUndefined();
  });

  it('グループ・レイアウトだけを置き換え、ワークスペースの所属・並び順は残す', () => {
    const raw = [
      { id: 'i1i1i1i1', type: 'item', displayName: 'x', path: 'C:\\x' },
      {
        id: 'g1g1g1g1',
        type: 'group',
        displayName: '朝',
        itemNames: ['Gmail'],
        workspaceId: 'ws1ws1ws',
        order: 3,
        addedAt: 10,
      },
      { id: 'l1l1l1l1', type: 'layout', displayName: '並べる', entries: [] },
      { id: 'bad1bad1', type: 'group', displayName: '' },
    ];
    expect(hasLegacySetItems(raw)).toBe(true);
    const result = convertLegacySetItems(raw, buildGroupNameResolver(items), 'sequential');
    expect(result.changed).toBe(true);
    expect(result.items).toEqual([
      raw[0],
      {
        id: 'g1g1g1g1',
        type: 'set',
        displayName: '朝',
        entries: [{ itemId: 'a1a1a1a1' }],
        workspaceId: 'ws1ws1ws',
        order: 3,
        addedAt: 10,
      },
      { id: 'l1l1l1l1', type: 'set', displayName: '並べる', entries: [], launchMode: 'parallel' },
      // 壊れたグループは変換せずに残す（読み込みが不正なアイテムとして扱う）
      raw[3],
    ]);
  });

  it('旧形式が無ければ変えない', () => {
    expect(hasLegacySetItems([{ type: 'set' }])).toBe(false);
    expect(convertLegacySetItems([{ type: 'item' }], () => undefined, 'sequential').changed).toBe(
      false
    );
  });
});
