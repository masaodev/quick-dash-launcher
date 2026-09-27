import { describe, it, expect } from 'vitest';

import type { BookmarkWithFolder } from '../types/bookmarkAutoImport';

import {
  applyBookmarkRuleFilters,
  buildBookmarkDisplayName,
  buildBookmarkFolderTree,
  validateBookmarkRulePatterns,
} from './bookmarkRuleFilter';

const bookmarks: BookmarkWithFolder[] = [
  { displayName: 'GitHub', url: 'https://github.com', folderPath: 'bookmark_bar/開発' },
  {
    displayName: 'GitHub Docs',
    url: 'https://docs.github.com',
    folderPath: 'bookmark_bar/開発/Docs',
  },
  { displayName: 'Google', url: 'https://www.google.com', folderPath: 'bookmark_bar' },
  { displayName: 'ニュース', url: 'https://news.example.com', folderPath: 'other/読み物' },
];

const baseFilter = {
  folderPaths: [] as string[],
  folderFilterMode: 'include' as const,
  includeSubfolders: true,
  urlPattern: '',
  namePattern: '',
};

describe('applyBookmarkRuleFilters', () => {
  it('条件なしなら全件', () => {
    expect(applyBookmarkRuleFilters(bookmarks, baseFilter)).toHaveLength(4);
  });

  it('選択フォルダのみ（サブフォルダ含む）', () => {
    const result = applyBookmarkRuleFilters(bookmarks, {
      ...baseFilter,
      folderPaths: ['bookmark_bar/開発'],
    });
    expect(result.map((b) => b.displayName)).toEqual(['GitHub', 'GitHub Docs']);
  });

  it('選択フォルダのみ（サブフォルダ含まない）', () => {
    const result = applyBookmarkRuleFilters(bookmarks, {
      ...baseFilter,
      folderPaths: ['bookmark_bar/開発'],
      includeSubfolders: false,
    });
    expect(result.map((b) => b.displayName)).toEqual(['GitHub']);
  });

  it('選択フォルダを除外', () => {
    const result = applyBookmarkRuleFilters(bookmarks, {
      ...baseFilter,
      folderPaths: ['bookmark_bar/開発'],
      folderFilterMode: 'exclude',
    });
    expect(result.map((b) => b.displayName)).toEqual(['Google', 'ニュース']);
  });

  it('URL・名前パターンは大文字小文字を区別しない正規表現', () => {
    expect(
      applyBookmarkRuleFilters(bookmarks, { ...baseFilter, urlPattern: 'GITHUB\\.com' }).map(
        (b) => b.displayName
      )
    ).toEqual(['GitHub', 'GitHub Docs']);
    expect(
      applyBookmarkRuleFilters(bookmarks, { ...baseFilter, namePattern: 'docs|ニュース' }).map(
        (b) => b.displayName
      )
    ).toEqual(['GitHub Docs', 'ニュース']);
  });

  it('無効な正規表現は絞り込まない', () => {
    expect(applyBookmarkRuleFilters(bookmarks, { ...baseFilter, urlPattern: '(' })).toHaveLength(4);
  });
});

describe('validateBookmarkRulePatterns', () => {
  it('空と妥当な正規表現は valid、壊れた正規表現は invalid', () => {
    expect(validateBookmarkRulePatterns({ urlPattern: '', namePattern: 'a|b' })).toEqual({
      urlPatternValid: true,
      namePatternValid: true,
    });
    expect(validateBookmarkRulePatterns({ urlPattern: '[', namePattern: '' })).toEqual({
      urlPatternValid: false,
      namePatternValid: true,
    });
  });
});

describe('buildBookmarkDisplayName', () => {
  const docs = bookmarks[1];
  it('フォルダ名付与のモード', () => {
    expect(buildBookmarkDisplayName(docs, { prefix: '', suffix: '', folderNameMode: 'none' })).toBe(
      'GitHub Docs'
    );
    expect(
      buildBookmarkDisplayName(docs, { prefix: '', suffix: '', folderNameMode: 'parent' })
    ).toBe('[Docs] GitHub Docs');
    expect(
      buildBookmarkDisplayName(docs, { prefix: '', suffix: '', folderNameMode: 'fullPath' })
    ).toBe('[bookmark_bar/開発/Docs] GitHub Docs');
    expect(
      buildBookmarkDisplayName(docs, { prefix: '', suffix: '', folderNameMode: 'relativePath' })
    ).toBe('[開発/Docs] GitHub Docs');
  });

  it('接頭辞・接尾辞はフォルダ名の外側に付く', () => {
    expect(
      buildBookmarkDisplayName(docs, {
        prefix: '[Chrome] ',
        suffix: ' (自動)',
        folderNameMode: 'parent',
      })
    ).toBe('[Chrome] [Docs] GitHub Docs (自動)');
  });
});

describe('buildBookmarkFolderTree', () => {
  it('パスから入れ子のツリーを組み立て、直下の件数を数える', () => {
    const tree = buildBookmarkFolderTree(bookmarks);
    expect(tree.map((f) => f.path)).toEqual(['bookmark_bar', 'other']);

    const bar = tree[0];
    expect(bar.bookmarkCount).toBe(1);
    expect(bar.children.map((f) => f.name)).toEqual(['開発']);
    const dev = bar.children[0];
    expect(dev.path).toBe('bookmark_bar/開発');
    expect(dev.bookmarkCount).toBe(1);
    expect(dev.children[0]).toMatchObject({
      path: 'bookmark_bar/開発/Docs',
      name: 'Docs',
      bookmarkCount: 1,
    });

    const other = tree[1];
    expect(other.bookmarkCount).toBe(0);
    expect(other.children[0]).toMatchObject({ path: 'other/読み物', bookmarkCount: 1 });
  });

  it('フォルダのないブックマークは無視する', () => {
    expect(
      buildBookmarkFolderTree([{ displayName: 'x', url: 'https://x', folderPath: '' }])
    ).toEqual([]);
  });
});
