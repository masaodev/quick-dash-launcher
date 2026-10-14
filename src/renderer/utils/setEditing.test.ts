import { describe, it, expect } from 'vitest';
import type { SetEntry, WindowInfo } from '@common/types';

import {
  describeSetEntry,
  entryFromWindow,
  entryOpensAsTab,
  linkEntryToWindow,
  setEntryNames,
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
});
