import { describe, it, expect } from 'vitest';
import type { SetEntry, WindowInfo } from '@common/types';

import {
  describeSetEntry,
  entryFromWindow,
  entryOpensAsTab,
  linkEntryToWindow,
  setEntryNames,
  setEntriesSummary,
  titleParts,
  windowPickNotes,
} from './setEditing';

function win(over: Partial<WindowInfo>): WindowInfo {
  return {
    hwnd: 1,
    title: 'TODOキャンパス - vault - Obsidian v1.9',
    x: 960,
    y: 0,
    width: 960,
    height: 1040,
    processId: 10,
    isVisible: true,
    processName: 'Obsidian.exe',
    windowState: 'normal',
    ...over,
  };
}

describe('linkEntryToWindow', () => {
  const entry: SetEntry = { open: { path: 'obsidian://open?vault=vault' } };

  it('見つけ方を決め、置き場所を今の位置にする', () => {
    const w = win({});
    expect(linkEntryToWindow(entry, w, [w])).toEqual({
      ...entry,
      window: { processName: 'Obsidian.exe' },
      placement: { x: 960, y: 0, width: 960, height: 1040 },
    });
  });

  it('最小化中のウィンドウは見つけ方だけ決め、置き場所は前のままにする', () => {
    const w = win({ windowState: 'minimized', x: -32000, y: -32000, width: 160, height: 28 });
    const before: SetEntry = { ...entry, placement: { x: 0, y: 0, width: 960, height: 1040 } };
    expect(linkEntryToWindow(before, w, [w])).toEqual({
      ...before,
      window: { processName: 'Obsidian.exe' },
    });
    expect(linkEntryToWindow(entry, w, [w]).placement).toBeUndefined();
  });
});

describe('describeSetEntry', () => {
  it('名前だけ残した行は参照先が見つからない行として出し、並べるだけの行とは分ける', () => {
    expect(describeSetEntry({ label: '消したアイテム' }, new Map())).toMatchObject({
      name: '消したアイテム',
      holding: 'ref',
      missing: true,
    });
    expect(
      describeSetEntry({ window: { processName: 'notepad.exe' }, placement: { x: 0 } }, new Map())
    ).toMatchObject({ holding: 'none', missing: false });
  });
});

describe('windowPickNotes', () => {
  it('最小化中・管理者権限のウィンドウを知らせる', () => {
    expect(windowPickNotes(win({}))).toEqual([]);
    expect(windowPickNotes(win({ windowState: 'minimized', isElevated: true }))).toEqual([
      'minimized',
      'elevated',
    ]);
  });
});

describe('entryOpensAsTab', () => {
  const view = (kind: Parameters<typeof entryOpensAsTab>[0]['kind']) => ({
    name: 'x',
    kind,
    holding: 'own' as const,
    missing: false,
  });

  it('フォルダと Web の URL はタブとして開くことがある', () => {
    expect(entryOpensAsTab(view('folder'))).toBe(true);
    expect(entryOpensAsTab(view('url'))).toBe(true);
    expect(entryOpensAsTab(view('customUri'))).toBe(false);
    expect(entryOpensAsTab(view('app'))).toBe(false);
    expect(entryOpensAsTab(view('none'))).toBe(false);
  });
});

describe('setEntryNames', () => {
  it('登録済みはアイテムの名前、それ以外は行の名前かパスの最後を使う', () => {
    const items = [
      { id: 'aaaa1111', type: 'url', displayName: 'Gmail', path: 'https://mail.google.com/' },
    ] as unknown as Parameters<typeof setEntryNames>[1];
    expect(
      setEntryNames(
        [
          { itemId: 'aaaa1111' },
          { label: '消した議事録' },
          { open: { path: 'C:\\Windows\\System32\\WFS.exe' } },
          { window: { processName: 'notepad.exe' } },
        ],
        items
      )
    ).toEqual(['Gmail', '消した議事録', 'WFS.exe', 'notepad.exe']);
  });
});

describe('entryFromWindow', () => {
  it('行の名前はウィンドウタイトルにする', () => {
    const w = win({ executablePath: 'C:/Apps/Obsidian.exe' });
    expect(entryFromWindow(w, [w]).label).toBe('TODOキャンパス - vault - Obsidian v1.9');
  });

  it('タイトルが空なら exe 名（拡張子なし）にする', () => {
    const w = win({ title: '  ' });
    expect(entryFromWindow(w, [w]).label).toBe('Obsidian');
  });

  it('開くものは持たない（動かすだけの行。ほかのアプリの起動の引数は取れない）', () => {
    const w = win({ executablePath: 'C:/Program Files (x86)/sakura/sakura.exe' });
    const entry = entryFromWindow(w, [w]);
    expect(entry.open).toBeUndefined();
    expect(entry.itemId).toBeUndefined();
    expect(entry.window).toEqual({ processName: 'Obsidian.exe' });
  });
});

describe('titleParts', () => {
  it('「 - 」「 | 」「 — 」で分ける', () => {
    expect(titleParts('一時メモ.txt - サクラエディタ32bit 2.4.3.7173')).toEqual([
      '一時メモ.txt',
      'サクラエディタ32bit 2.4.3.7173',
    ]);
    expect(titleParts('Inbox | Mail — Edge')).toEqual(['Inbox', 'Mail', 'Edge']);
  });

  it('区切りが無ければ候補を出さない（空白の無いハイフンは区切りにしない）', () => {
    expect(titleParts('メモ帳')).toEqual([]);
    expect(titleParts('foo-bar.txt')).toEqual([]);
  });

  it('ワイルドカードは除き、同じ部品は 1 つにする', () => {
    expect(titleParts('*一時メモ.txt* - a - a')).toEqual(['一時メモ.txt', 'a']);
  });
});

describe('setEntriesSummary', () => {
  const nameOf = (id: string) => (id === 'gmail1aa' ? 'Gmail' : undefined);

  it('先頭 3 行の名前を並べ、残りは件数にする', () => {
    const entries: SetEntry[] = [
      { itemId: 'gmail1aa' },
      { label: '一時メモ' },
      { open: { path: 'C:/tools/notepad.exe' } },
      { window: { processName: 'sticky.exe' } },
    ];
    expect(setEntriesSummary(entries, nameOf)).toBe('行: Gmail、一時メモ、notepad.exe ほか1件');
  });

  it('3 行以下なら名前だけ。名前を引けない行は件数に回す', () => {
    expect(setEntriesSummary([{ itemId: 'gmail1aa' }], nameOf)).toBe('行: Gmail');
    expect(setEntriesSummary([{ itemId: 'gmail1aa' }, { itemId: 'nobody11' }], nameOf)).toBe(
      '行: Gmail ほか1件'
    );
  });
});
