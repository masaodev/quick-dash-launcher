import { describe, expect, it } from 'vitest';

import { restoreUnknownKeys } from './unknownKeys';

describe('restoreUnknownKeys（データファイル）', () => {
  it('同じ id のアイテムが持っていた知らない項目を付け直す', () => {
    const disk = {
      version: '1.0',
      futureTop: { a: 1 },
      items: [{ id: 'Aaaaaaa1', type: 'item', displayName: 'A', path: 'C:\\a', newOption: true }],
    };
    const next = {
      version: '1.0',
      items: [{ id: 'Aaaaaaa1', type: 'item', displayName: 'A2', path: 'C:\\a' }],
    };

    expect(restoreUnknownKeys('data', next, { target: disk })).toBe(true);
    expect(next).toEqual({
      version: '1.0',
      items: [{ id: 'Aaaaaaa1', type: 'item', displayName: 'A2', path: 'C:\\a', newOption: true }],
      futureTop: { a: 1 },
    });
  });

  it('知っている項目は戻さない（空にした引数・旧形式から変換した項目）', () => {
    const disk = {
      version: '1.0',
      items: [
        { id: 'Aaaaaaa1', type: 'item', displayName: 'A', path: 'C:\\a', args: '--x' },
        { id: 'Bbbbbbb2', type: 'group', displayName: 'G', itemNames: ['A'] },
        { id: 'Ccccccc3', type: 'item', displayName: 'C', path: '', windowConfig: { title: 'x' } },
      ],
    };
    const next = {
      version: '1.0',
      items: [
        { id: 'Aaaaaaa1', type: 'item', displayName: 'A', path: 'C:\\a' },
        { id: 'Bbbbbbb2', type: 'set', displayName: 'G', entries: [] },
        { id: 'Ccccccc3', type: 'item', displayName: 'C', path: '', window: { title: 'x' } },
      ],
    };
    const before = structuredClone(next);

    expect(restoreUnknownKeys('data', next, { target: disk })).toBe(false);
    expect(next).toEqual(before);
  });

  it('書く側の値を優先し、$schema は戻さない', () => {
    const disk = {
      $schema: './schemas/data.schema.json',
      version: '1.0',
      items: [{ id: 'Aaaaaaa1', type: 'item', displayName: 'A', path: 'p', extra: 'old' }],
    };
    const next = {
      version: '1.0',
      items: [{ id: 'Aaaaaaa1', type: 'item', displayName: 'A', path: 'p', extra: 'new' }],
    };

    expect(restoreUnknownKeys('data', next, { target: disk })).toBe(false);
    expect(next.items[0].extra).toBe('new');
    expect(next).not.toHaveProperty('$schema');
  });

  it('ほかのデータファイルから移ってきたアイテムの項目も付け直す（ファイル直下は書く先からだけ）', () => {
    const target = { version: '1.0', items: [] };
    const other = {
      version: '1.0',
      otherTop: 1,
      items: [{ id: 'Aaaaaaa1', type: 'item', displayName: 'A', path: 'p', moved: true }],
    };
    const next = {
      version: '1.0',
      items: [{ id: 'Aaaaaaa1', type: 'item', displayName: 'A', path: 'p' }],
    };

    expect(restoreUnknownKeys('data', next, { target, others: [other] })).toBe(true);
    expect(next.items[0]).toHaveProperty('moved', true);
    expect(next).not.toHaveProperty('otherTop');
  });

  it('入れ子の中の知らない項目は対象外（今の作り）', () => {
    const disk = {
      version: '1.0',
      items: [{ id: 'Aaaaaaa1', type: 'dir', path: 'p', options: { depth: 1, future: true } }],
    };
    const next = {
      version: '1.0',
      items: [{ id: 'Aaaaaaa1', type: 'dir', path: 'p', options: { depth: 1 } }],
    };

    expect(restoreUnknownKeys('data', next, { target: disk })).toBe(false);
    expect(next.items[0].options).toEqual({ depth: 1 });
  });

  it('書く先が無い・壊れていても何もしない', () => {
    const next = { version: '1.0', items: [{ id: 'Aaaaaaa1', type: 'item' }] };
    expect(restoreUnknownKeys('data', next, { target: undefined })).toBe(false);
    expect(restoreUnknownKeys('data', next, { target: 'broken' })).toBe(false);
  });
});

describe('restoreUnknownKeys（ワークスペース）', () => {
  it('タブ・グループ・アイテムの知らない項目を付け直す', () => {
    const disk = {
      version: '2.0',
      workspaces: [{ id: 'Wwwwwww1', displayName: 'W', order: 0, createdAt: 1, wsExtra: 1 }],
      groups: [
        {
          id: 'Ggggggg1',
          displayName: 'G',
          color: 'primary',
          order: 0,
          createdAt: 1,
          workspaceId: 'Wwwwwww1',
          groupExtra: 'x',
        },
      ],
      items: [
        {
          id: 'Iiiiiii1',
          type: 'ref',
          refItemId: 'Aaaaaaa1',
          workspaceId: 'Wwwwwww1',
          groupId: 'Ggggggg1',
          order: 0,
          addedAt: 1,
          itemExtra: [1, 2],
        },
      ],
    };
    const next = {
      version: '2.0',
      workspaces: [{ id: 'Wwwwwww1', displayName: 'W2', order: 0, createdAt: 1 }],
      groups: [
        {
          id: 'Ggggggg1',
          displayName: 'G',
          color: 'primary',
          order: 0,
          createdAt: 1,
          workspaceId: 'Wwwwwww1',
        },
      ],
      items: [
        {
          id: 'Iiiiiii1',
          type: 'ref',
          refItemId: 'Aaaaaaa1',
          workspaceId: 'Wwwwwww1',
          groupId: 'Ggggggg1',
          order: 1,
          addedAt: 1,
        },
      ],
    };

    expect(restoreUnknownKeys('workspace', next, { target: disk })).toBe(true);
    expect(next.workspaces[0]).toHaveProperty('wsExtra', 1);
    expect(next.groups[0]).toHaveProperty('groupExtra', 'x');
    expect(next.items[0]).toHaveProperty('itemExtra', [1, 2]);
    expect(next.items[0].order).toBe(1);
  });

  it('アーカイブとの間で移ったアイテムの項目を付け直す', () => {
    const main = { version: '2.0', workspaces: [], groups: [], items: [] };
    const archive = {
      version: '2.0',
      groups: [],
      items: [{ id: 'Iiiiiii1', type: 'item', displayName: 'A', path: 'p', archived: 'x' }],
    };
    const next = {
      version: '2.0',
      workspaces: [],
      groups: [],
      items: [{ id: 'Iiiiiii1', type: 'item', displayName: 'A', path: 'p' }],
    };

    expect(restoreUnknownKeys('workspace', next, { target: main, others: [archive] })).toBe(true);
    expect(next.items[0]).toHaveProperty('archived', 'x');
  });
});
