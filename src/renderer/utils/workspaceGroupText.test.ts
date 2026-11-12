import { describe, expect, it } from 'vitest';
import type { MixedChild, WorkspaceGroup, WorkspaceItem } from '@common/types';

import { formatGroupAsText } from './workspaceGroupText';

const group = (id: string, displayName: string, parentGroupId?: string): WorkspaceGroup =>
  ({ id, displayName, parentGroupId, order: 0 }) as unknown as WorkspaceGroup;
const item = (id: string, displayName: string, path: string): WorkspaceItem =>
  ({ id, displayName, path, type: 'item' }) as unknown as WorkspaceItem;
const describe2 = (i: WorkspaceItem) => (i as unknown as { path: string }).path;

describe('formatGroupAsText', () => {
  it('サブグループが無ければ従来と同じ形', () => {
    const g = group('g', '親');
    const mixed: Record<string, MixedChild[]> = {
      g: [
        { kind: 'item', item: item('a', 'A', 'C:\\a.txt') },
        { kind: 'item', item: item('b', 'B', 'https://b.example') },
      ],
    };
    expect(formatGroupAsText(g, mixed, describe2)).toBe(
      '【親】\r\n　■A\r\n　　C:\\a.txt\r\n\r\n　■B\r\n　　https://b.example\r\n'
    );
  });

  it('サブグループを画面と同じ並びで、見出しと字下げ付きで含める', () => {
    const g = group('g', '親');
    const sub = group('s', '子', 'g');
    const subsub = group('ss', '孫', 's');
    const mixed: Record<string, MixedChild[]> = {
      g: [
        { kind: 'group', group: sub },
        { kind: 'item', item: item('a', 'A', 'a') },
      ],
      s: [
        { kind: 'item', item: item('b', 'B', 'b') },
        { kind: 'group', group: subsub },
      ],
      ss: [{ kind: 'item', item: item('c', 'C', 'c') }],
    };
    expect(formatGroupAsText(g, mixed, describe2).split('\r\n')).toEqual([
      '【親】',
      '　【子】',
      '　　■B',
      '　　　b',
      '',
      '　　【孫】',
      '　　　■C',
      '　　　　c',
      '',
      '　■A',
      '　　a',
      '',
    ]);
  });

  it('空のグループは見出しだけ', () => {
    expect(formatGroupAsText(group('g', '親'), {}, describe2)).toBe('【親】\r\n');
  });

  it('親子が輪になった壊れたデータでも止まる', () => {
    const a = group('a', 'A', 'b');
    const b = group('b', 'B', 'a');
    const mixed: Record<string, MixedChild[]> = {
      a: [{ kind: 'group', group: b }],
      b: [{ kind: 'group', group: a }],
    };
    expect(formatGroupAsText(a, mixed, describe2)).toBe('【A】\r\n　【B】\r\n');
  });
});
