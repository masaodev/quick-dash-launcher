import { describe, it, expect } from 'vitest';

import { titleToEntryName, windowMatchEntryName } from './windowTitle';

describe('titleToEntryName（セットの行の自動の名前）', () => {
  it('区切りで 2 つ以上に分かれるタイトルは、最後の部品を落とす', () => {
    expect(titleToEntryName('TODOキャンパス - obsidian-pri - Obsidian 1.14.4')).toBe(
      'TODOキャンパス - obsidian-pri'
    );
    expect(titleToEntryName('一時メモ.txt - サクラエディタ32bit 2.4.3.7173')).toBe('一時メモ.txt');
    expect(titleToEntryName('a | b')).toBe('a');
    expect(titleToEntryName('a — b – c')).toBe('a — b');
  });

  it('区切りが無ければ前後の空白を落としただけ', () => {
    expect(titleToEntryName('  Microsoft To Do  ')).toBe('Microsoft To Do');
    // 空白に挟まれていない「-」は区切りにしない
    expect(titleToEntryName('obsidian-pri')).toBe('obsidian-pri');
    expect(titleToEntryName('')).toBe('');
  });

  it('区切りの前が空なら、タイトルのまま', () => {
    expect(titleToEntryName(' - Obsidian')).toBe('- Obsidian');
  });
});

describe('windowMatchEntryName（名前の無い、動かすだけの行の名前）', () => {
  it('タイトルのワイルドカードを除いて同じ規則をかける', () => {
    expect(windowMatchEntryName({ title: '*一時メモ.txt*', processName: 'sakura.exe' })).toBe(
      '一時メモ.txt'
    );
    expect(windowMatchEntryName({ title: 'メモ - sakura', processName: 'sakura.exe' })).toBe(
      'メモ'
    );
  });

  it('タイトルが無い・ワイルドカードだけなら exe 名、どちらも無ければ空', () => {
    expect(windowMatchEntryName({ title: '*', processName: 'notepad.exe' })).toBe('notepad.exe');
    expect(windowMatchEntryName({ processName: 'notepad.exe' })).toBe('notepad.exe');
    expect(windowMatchEntryName(undefined)).toBe('');
  });
});
