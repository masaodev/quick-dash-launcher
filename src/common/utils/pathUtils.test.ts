import { describe, it, expect } from 'vitest';

import { PathUtils } from './pathUtils';

describe('PathUtils.isCustomUriScheme', () => {
  it('スラッシュ付きのカスタムURIを判定する', () => {
    expect(PathUtils.isCustomUriScheme('obsidian://advanced-uri?vault=test')).toBe(true);
    expect(PathUtils.isCustomUriScheme('vscode://file/c:/work')).toBe(true);
  });

  it('スラッシュなしのカスタムURIを判定する', () => {
    expect(PathUtils.isCustomUriScheme('ms-todo:')).toBe(true);
    expect(PathUtils.isCustomUriScheme('ms-excel:ofe|u|https://example.com/Book.xlsx')).toBe(true);
    expect(PathUtils.isCustomUriScheme('mailto:test@example.com')).toBe(true);
  });

  it('Windowsのドライブレターはカスタムスキームとみなさない', () => {
    expect(PathUtils.isCustomUriScheme('C:\\Windows\\explorer.exe')).toBe(false);
    expect(PathUtils.isCustomUriScheme('c:/Users/test/file.txt')).toBe(false);
    expect(PathUtils.isCustomUriScheme('D:\\')).toBe(false);
  });

  it('shell: と file: は専用経路のため除外する', () => {
    expect(PathUtils.isCustomUriScheme('shell:AppsFolder\\Microsoft.Todos_8wekyb3d8bbwe!App')).toBe(
      false
    );
    expect(PathUtils.isCustomUriScheme('shell:Downloads')).toBe(false);
    expect(PathUtils.isCustomUriScheme('file:///C:/work/memo.txt')).toBe(false);
  });

  it('スキームを持たないパスや空値はfalseを返す', () => {
    expect(PathUtils.isCustomUriScheme('wt.exe')).toBe(false);
    expect(PathUtils.isCustomUriScheme('C:\\Users\\daido\\一時メモ.txt')).toBe(false);
    expect(PathUtils.isCustomUriScheme('')).toBe(false);
    expect(PathUtils.isCustomUriScheme(undefined)).toBe(false);
  });

  it('スキーム名として不正な文字列はfalseを返す', () => {
    expect(PathUtils.isCustomUriScheme('1http://example.com')).toBe(false);
    expect(PathUtils.isCustomUriScheme('://example.com')).toBe(false);
  });
});

describe('PathUtils.getParentPath', () => {
  it('ファイルパスの親フォルダを返す', () => {
    expect(PathUtils.getParentPath('C:\\work\\memo.txt')).toBe('C:\\work');
  });

  it('末尾の区切り文字は無視する（末尾に区切り文字を付けて保存したドット入りのフォルダ）', () => {
    expect(PathUtils.getParentPath('C:\\work\\j-gate3.0\\')).toBe('C:\\work');
    expect(PathUtils.getParentPath('\\\\server\\share\\v1.2\\')).toBe('\\\\server\\share');
    expect(PathUtils.getParentPath('/home/user/v1.2/')).toBe('/home/user');
  });

  it('親がないときは空文字を返す', () => {
    expect(PathUtils.getParentPath('memo.txt')).toBe('');
  });
});

describe('PathUtils.getLastSegment', () => {
  it('パスの最後の要素を返す', () => {
    expect(PathUtils.getLastSegment('C:\\Program Files\\app.exe')).toBe('app.exe');
    expect(PathUtils.getLastSegment('C:/work/memo.txt')).toBe('memo.txt');
    expect(PathUtils.getLastSegment('notepad.exe')).toBe('notepad.exe');
  });

  it('末尾の区切り文字は無視する', () => {
    expect(PathUtils.getLastSegment('C:\\work\\j-gate3.0\\')).toBe('j-gate3.0');
    expect(PathUtils.getLastSegment('C:/work//')).toBe('work');
  });

  it('最後の要素が取れなければ元のパスを返す', () => {
    expect(PathUtils.getLastSegment('\\')).toBe('\\');
    expect(PathUtils.getLastSegment('')).toBe('');
  });
});
