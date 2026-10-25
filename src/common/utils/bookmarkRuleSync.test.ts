import { describe, it, expect } from 'vitest';

import type { JsonItem, JsonLauncherItem } from '../types';

import { syncBookmarkRuleItems } from './bookmarkRuleSync';

const RULE = 'rule0001';
const NOW = 2000;

function ruleItem(id: string, url: string, displayName: string, extra = {}): JsonLauncherItem {
  return {
    id,
    type: 'item',
    displayName,
    path: url,
    autoImportRuleId: RULE,
    updatedAt: 1000,
    ...extra,
  };
}

function idSource(): () => string {
  let n = 0;
  return () => `new${String(++n).padStart(5, '0')}`;
}

describe('syncBookmarkRuleItems', () => {
  it('変わっていなければ何も数えず、アイテムもそのまま', () => {
    const items: JsonItem[] = [ruleItem('a0000001', 'https://a', 'A')];
    const result = syncBookmarkRuleItems(
      items,
      RULE,
      [{ url: 'https://a', displayName: 'A' }],
      NOW,
      idSource()
    );
    expect(result.counts).toEqual({ added: 0, updated: 0, deleted: 0 });
    expect(result.items).toEqual(items);
    expect(result.items[0]).toBe(items[0]);
  });

  it('表示名が変わったら表示名と updatedAt だけ書き換え、手で付けた項目は残す', () => {
    const items: JsonItem[] = [
      ruleItem('a0000001', 'https://a', 'A', { memo: 'メモ', customIcon: 'a.png', args: '-x' }),
    ];
    const result = syncBookmarkRuleItems(
      items,
      RULE,
      [{ url: 'https://a', displayName: 'A2' }],
      NOW,
      idSource()
    );
    expect(result.counts).toEqual({ added: 0, updated: 1, deleted: 0 });
    expect(result.items).toEqual([
      ruleItem('a0000001', 'https://a', 'A2', {
        memo: 'メモ',
        customIcon: 'a.png',
        args: '-x',
        updatedAt: NOW,
      }),
    ]);
  });

  it('消えた URL は消し、新しい URL は末尾に足す。ほかの位置は保つ', () => {
    const manual: JsonItem = { id: 'm0000001', type: 'item', displayName: 'M', path: 'https://m' };
    const items: JsonItem[] = [
      ruleItem('a0000001', 'https://a', 'A'),
      manual,
      ruleItem('b0000001', 'https://b', 'B'),
    ];
    const result = syncBookmarkRuleItems(
      items,
      RULE,
      [
        { url: 'https://c', displayName: 'C' },
        { url: 'https://b', displayName: 'B' },
      ],
      NOW,
      idSource()
    );
    expect(result.counts).toEqual({ added: 1, updated: 0, deleted: 1 });
    expect(result.items).toEqual([
      manual,
      items[2],
      {
        id: 'new00001',
        type: 'item',
        displayName: 'C',
        path: 'https://c',
        autoImportRuleId: RULE,
        updatedAt: NOW,
      },
    ]);
  });

  it('ほかのルールと手動のアイテムは、同じ URL でも触らない', () => {
    const other = { ...ruleItem('o0000001', 'https://a', 'A'), autoImportRuleId: 'rule0002' };
    const manual: JsonItem = { id: 'm0000001', type: 'item', displayName: 'A', path: 'https://a' };
    const result = syncBookmarkRuleItems([other, manual], RULE, [], NOW, idSource());
    expect(result.counts).toEqual({ added: 0, updated: 0, deleted: 0 });
    expect(result.items).toEqual([other, manual]);
  });

  it('同じ URL が複数あるときは出現順で対応づけ、余りを足し引きする', () => {
    const items: JsonItem[] = [
      ruleItem('a0000001', 'https://a', 'A (1)'),
      ruleItem('a0000002', 'https://a', 'A (2)'),
    ];
    const grown = syncBookmarkRuleItems(
      items,
      RULE,
      [
        { url: 'https://a', displayName: 'A (1)' },
        { url: 'https://a', displayName: 'A (2)' },
        { url: 'https://a', displayName: 'A (3)' },
      ],
      NOW,
      idSource()
    );
    expect(grown.counts).toEqual({ added: 1, updated: 0, deleted: 0 });
    expect(grown.items.map((i) => i.id)).toEqual(['a0000001', 'a0000002', 'new00001']);

    const shrunk = syncBookmarkRuleItems(
      items,
      RULE,
      [{ url: 'https://a', displayName: 'A (1)' }],
      NOW,
      idSource()
    );
    expect(shrunk.counts).toEqual({ added: 0, updated: 0, deleted: 1 });
    expect(shrunk.items.map((i) => i.id)).toEqual(['a0000001']);
  });

  it('渡した配列は書き換えない', () => {
    const items: JsonItem[] = [ruleItem('a0000001', 'https://a', 'A')];
    const snapshot = structuredClone(items);
    syncBookmarkRuleItems(items, RULE, [{ url: 'https://a', displayName: 'B' }], NOW, idSource());
    expect(items).toEqual(snapshot);
  });
});
