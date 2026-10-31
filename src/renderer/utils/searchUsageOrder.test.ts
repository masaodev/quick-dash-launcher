import { describe, it, expect } from 'vitest';
import type { AppItem } from '@common/types';
import type { LaunchUsageSnapshot } from '@common/types/launchUsage';

import { launchCountOf, sortByUsage } from './searchUsageOrder';

const item = (id: string, displayName: string, extra: Record<string, unknown> = {}) =>
  ({ id, displayName, path: `C:/apps/${id}.exe`, type: 'app', ...extra }) as unknown as AppItem;

describe('sortByUsage', () => {
  const memoPad = item('a', '議事録メモ');
  const memoApp = item('b', 'メモ帳');
  const memoOld = item('c', 'メモの書き方');
  const counts: Record<string, number> = { a: 50, b: 3, c: 0 };
  const countOf = (i: AppItem) => counts[(i as { id: string }).id] ?? 0;

  it('名前が最初の語で始まるもの → 開いた回数の多い順 → 今の順', () => {
    expect(sortByUsage([memoPad, memoOld, memoApp], 'メモ', countOf)).toEqual([
      memoApp,
      memoOld,
      memoPad,
    ]);
  });

  it('同じ順位のものは今の順を保つ', () => {
    const x = item('x', 'メモ1');
    const y = item('y', 'メモ2');
    expect(sortByUsage([y, x], 'メモ', () => 0)).toEqual([y, x]);
  });

  it('検索語が空なら並べ替えない', () => {
    const list = [memoPad, memoOld, memoApp];
    expect(sortByUsage(list, '  ', countOf)).toBe(list);
  });
});

describe('launchCountOf', () => {
  const usage: LaunchUsageSnapshot = {
    since: 0,
    byId: { a: { count: 4, lastLaunchedAt: 1 }, dir1: { count: 9, lastLaunchedAt: 1 } },
    byPath: { 'c:/apps/a.exe': { count: 2, lastLaunchedAt: 2 } },
  };

  it('id の記録と、ワークスペースから同じパスを開いた記録を足す', () => {
    expect(launchCountOf(item('a', 'A'), usage)).toBe(6);
  });

  it('フォルダ取込で展開したアイテムは 1 件ずつの回数が分からないので 0', () => {
    expect(
      launchCountOf(item('z', 'Z', { isDirExpanded: true, expandedFromId: 'dir1' }), usage)
    ).toBe(0);
  });

  it('記録が無ければ 0', () => {
    expect(launchCountOf(item('n', 'N'), usage)).toBe(0);
  });
});
