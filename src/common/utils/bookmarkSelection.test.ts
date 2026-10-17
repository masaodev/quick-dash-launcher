import { describe, it, expect } from 'vitest';

import type { BookmarkWithFolder } from '../types/bookmarkAutoImport';

import { isInFolder, selectionAsRule } from './bookmarkSelection';

const bookmarks: BookmarkWithFolder[] = [
  { displayName: 'GitHub', url: 'https://github.com/', folderPath: 'bookmark_bar/開発' },
  { displayName: 'React', url: 'https://ja.react.dev/', folderPath: 'bookmark_bar/開発/React' },
  { displayName: 'Zenn', url: 'https://zenn.dev/', folderPath: 'bookmark_bar/読み物' },
  { displayName: 'Gmail', url: 'https://mail.google.com/', folderPath: 'bookmark_bar' },
  { displayName: 'カレンダー', url: 'https://calendar.google.com/', folderPath: 'other' },
];

describe('isInFolder', () => {
  it('同じフォルダとサブフォルダは中、名前が前方一致するだけの別フォルダは外', () => {
    expect(isInFolder('bookmark_bar/開発', 'bookmark_bar/開発')).toBe(true);
    expect(isInFolder('bookmark_bar/開発/React', 'bookmark_bar/開発')).toBe(true);
    expect(isInFolder('bookmark_bar/開発2', 'bookmark_bar/開発')).toBe(false);
  });
});

describe('selectionAsRule', () => {
  it('何も選んでいなければルールにできない', () => {
    expect(selectionAsRule(bookmarks, new Set())).toEqual({
      ok: false,
      allFolders: false,
      folderPaths: [],
    });
  });

  it('フォルダの中身ぜんぶ（サブフォルダ込み）なら、そのフォルダのルールにできる', () => {
    expect(selectionAsRule(bookmarks, new Set([0, 1]))).toEqual({
      ok: true,
      allFolders: false,
      folderPaths: ['bookmark_bar/開発'],
    });
  });

  it('いくつかのフォルダを選べば、それぞれの一番上のフォルダになる', () => {
    expect(selectionAsRule(bookmarks, new Set([1, 2, 4])).folderPaths).toEqual([
      'bookmark_bar/開発/React',
      'bookmark_bar/読み物',
      'other',
    ]);
  });

  it('1 件ずつ選んだ分が混ざるとルールにできない', () => {
    // GitHub だけ（開発フォルダには React もある）
    expect(selectionAsRule(bookmarks, new Set([0])).ok).toBe(false);
    // 読み物フォルダ＋ Gmail（ブックマーク バーの直下だけ）
    expect(selectionAsRule(bookmarks, new Set([2, 3])).ok).toBe(false);
  });

  it('全部を選べば「すべてのフォルダ」（folderPaths は空）', () => {
    expect(selectionAsRule(bookmarks, new Set([0, 1, 2, 3, 4]))).toEqual({
      ok: true,
      allFolders: true,
      folderPaths: [],
    });
  });

  it('親フォルダの中身ぜんぶなら、子ではなく親のフォルダになる', () => {
    expect(selectionAsRule(bookmarks, new Set([0, 1, 2, 3])).folderPaths).toEqual(['bookmark_bar']);
  });
});
