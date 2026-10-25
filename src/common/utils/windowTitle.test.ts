import { describe, it, expect } from 'vitest';

import { titleToEntryName, titleToPartialPattern, windowMatchEntryName } from './windowTitle';

describe('titleToPartialPattern（記録するタイトルの一部一致の形）', () => {
  it('最後の部品を落とし、残りを * で囲む', () => {
    expect(titleToPartialPattern('一時メモ.txt - サクラエディタ32bit 2.4.3.7173  ')).toBe(
      '*一時メモ.txt*'
    );
    expect(titleToPartialPattern('TODOキャンパス - obsidian-pri - Obsidian 1.14.5')).toBe(
      '*TODOキャンパス - obsidian-pri*'
    );
    // 名前の中の「 - 」は残し、落とすのは最後の部品だけ
    expect(titleToPartialPattern('見積 - コピー.xlsx - Excel')).toBe('*見積 - コピー.xlsx*');
    expect(titleToPartialPattern('ページ — Mozilla Firefox')).toBe('*ページ*');
  });

  it('元のタイトルの * と ? は除く（ワイルドカードと取り違えない）', () => {
    expect(titleToPartialPattern('*memo.txt - メモ帳')).toBe('*memo.txt*');
    expect(titleToPartialPattern('何? - Editor')).toBe('*何*');
  });

  it('区切りで分かれないタイトルは undefined（タイトル全体で探す）', () => {
    expect(titleToPartialPattern('Microsoft To Do')).toBeUndefined();
    expect(titleToPartialPattern('report-2026.txt-MyEditor 1.2')).toBeUndefined();
    expect(titleToPartialPattern(' - Obsidian')).toBeUndefined();
    expect(titleToPartialPattern('')).toBeUndefined();
  });
});

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
