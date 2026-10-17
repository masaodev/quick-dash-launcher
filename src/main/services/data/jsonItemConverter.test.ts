import { describe, expect, it, vi } from 'vitest';
import type { JsonLauncherItem } from '@common/types';

vi.mock('electron', () => ({ shell: { readShortcutLink: vi.fn() } }));

import { convertJsonItemToAppItems } from './jsonItemConverter';

/** 同じタブのアイテムを順に変換し、残ったアイテムの id を返す */
async function convertTab(jsonItems: JsonLauncherItem[]) {
  const seenPaths = new Set<string>();
  const results = [];
  for (const [index, jsonItem] of jsonItems.entries()) {
    results.push(...(await convertJsonItemToAppItems(jsonItem, 'data.json', index, seenPaths, 0)));
  }
  return results.map((r) => ('id' in r ? r.id : undefined));
}

function item(id: string, displayName: string, path: string, window?: JsonLauncherItem['window']) {
  return { id, type: 'item', displayName, path, ...(window ? { window } : {}) } as JsonLauncherItem;
}

describe('convertJsonItemToAppItems のタブ内の重複', () => {
  it('表示名とパスが同じアイテムは、後のほうを読み飛ばす', async () => {
    const results = await convertTab([
      item('a1', 'Google', 'https://www.google.com'),
      item('a2', 'Google', 'https://www.google.com'),
    ]);
    expect(results).toEqual(['a1']);
  });

  it('パスの無い単一アイテムは、表示名が同じでも対象ウィンドウが違えば両方残す', async () => {
    const results = await convertTab([
      item('b1', 'ターミナル', '', { processName: 'WindowsTerminal.exe', title: '仕事' }),
      item('b2', 'ターミナル', '', { processName: 'WindowsTerminal.exe', title: '個人' }),
    ]);
    expect(results).toEqual(['b1', 'b2']);
  });

  it('パスの無い単一アイテムでも、表示名と対象ウィンドウが同じなら後のほうを読み飛ばす', async () => {
    const results = await convertTab([
      item('c1', 'メモ帳', '', { processName: 'notepad.exe' }),
      item('c2', 'メモ帳', '', { processName: 'notepad.exe' }),
    ]);
    expect(results).toEqual(['c1']);
  });
});
