import { describe, it, expect } from 'vitest';
import type { SetEntry, WindowInfo } from '@common/types';

import {
  describeSetEntry,
  entryFromWindow,
  entryOpensAsTab,
  linkEntryToWindow,
  setEntryNames,
  setEntriesSummary,
  placementText,
  titleParts,
  windowPickNotes,
  windowPlacementText,
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
    expect(linkEntryToWindow(entry, w)).toEqual({
      ...entry,
      window: { processName: 'Obsidian.exe', title: 'TODOキャンパス - vault - Obsidian v1.9' },
      placement: { x: 960, y: 0, width: 960, height: 1040 },
    });
  });

  it('最小化中のウィンドウは見つけ方だけ決め、置き場所は前のままにする', () => {
    const w = win({ windowState: 'minimized', x: -32000, y: -32000, width: 160, height: 28 });
    const before: SetEntry = { ...entry, placement: { x: 0, y: 0, width: 960, height: 1040 } };
    expect(linkEntryToWindow(before, w)).toEqual({
      ...before,
      window: { processName: 'Obsidian.exe', title: 'TODOキャンパス - vault - Obsidian v1.9' },
    });
    expect(linkEntryToWindow(entry, w).placement).toBeUndefined();
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
    expect(entryFromWindow(w).label).toBe('TODOキャンパス - vault - Obsidian v1.9');
  });

  it('今の位置を持つ。最小化中のウィンドウは位置を持たない（座標が画面の外になる）', () => {
    expect(entryFromWindow(win({})).placement).toMatchObject({ x: 960, y: 0, width: 960 });
    const minimized = entryFromWindow(win({ windowState: 'minimized', x: -32000, y: -32000 }));
    expect(minimized.placement).toBeUndefined();
    expect(minimized.window?.processName).toBe('Obsidian.exe');
  });

  it('タイトルが空なら exe 名（拡張子なし）にする', () => {
    const w = win({ title: '  ' });
    expect(entryFromWindow(w).label).toBe('Obsidian');
  });

  it('開くものは持たない（動かすだけの行。ほかのアプリの起動の引数は取れない）', () => {
    const w = win({ executablePath: 'C:/Program Files (x86)/sakura/sakura.exe' });
    const entry = entryFromWindow(w);
    expect(entry.open).toBeUndefined();
    expect(entry.itemId).toBeUndefined();
    expect(entry.window).toEqual({
      processName: 'Obsidian.exe',
      title: 'TODOキャンパス - vault - Obsidian v1.9',
    });
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

  it('名前が 1 つも分からなければ空（ツールチップに出さない）', () => {
    expect(setEntriesSummary([{ itemId: 'nobody11' }], nameOf)).toBe('');
  });
});

describe('仮想デスクトップの記録と表示', () => {
  const screens = [
    {
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    },
  ];

  it('デスクトップが 2 つ以上なら番号を記録し、1 つなら記録しない', () => {
    const w = win({ desktopNumber: 2 });
    expect(entryFromWindow(w, 3).placement?.virtualDesktopNumber).toBe(2);
    expect(entryFromWindow(w, 1).placement?.virtualDesktopNumber).toBeUndefined();
    expect(
      linkEntryToWindow({ itemId: 'a' }, w, 1).placement?.virtualDesktopNumber
    ).toBeUndefined();
  });

  it('行の置き場所の表示に番号を添える', () => {
    const entry: SetEntry = {
      placement: { x: 960, y: 0, width: 960, height: 1040, virtualDesktopNumber: 2 },
    };
    expect(placementText(entry, screens)).toMatch(/2$/);
    expect(
      placementText({ placement: { ...entry.placement, virtualDesktopNumber: undefined } }, screens)
    ).not.toMatch(/2$/);
  });

  it('ウィンドウを選ぶ画面のウィンドウは、デスクトップが 2 つ以上のときだけ番号・全デスクトップを添える', () => {
    const plain = windowPlacementText(win({ desktopNumber: 2 }), screens, 1);
    expect(windowPlacementText(win({ desktopNumber: 2 }), screens, 3)).not.toBe(plain);
    expect(windowPlacementText(win({ desktopNumber: 2 }), screens, 3)).toMatch(/2$/);
    const pinned = windowPlacementText(win({ desktopNumber: -1, isPinned: true }), screens, 3);
    expect(pinned).not.toBe(plain);
    expect(pinned).not.toMatch(/-1/);
    expect(windowPlacementText(win({ isPinned: true }), screens, 1)).toBe(plain);
  });

  it('ウィンドウを選ぶ画面の最大化中のウィンドウは、記録した後の行と同じ表示にする', () => {
    const w = win({ windowState: 'maximized', x: -8, y: -8, width: 1936, height: 1056 });
    expect(windowPlacementText(w, screens, 1)).toBe(placementText(entryFromWindow(w, 1), screens));
  });
});
