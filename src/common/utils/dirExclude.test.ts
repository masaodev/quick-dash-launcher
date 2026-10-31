import { describe, expect, it } from 'vitest';
import { minimatch } from 'minimatch';

import { appendExcludeName, escapeExcludeName, matchesDirPattern } from './dirExclude';

describe('matchesDirPattern', () => {
  it.each([
    ['SCAN.PDF', '*.pdf', true],
    ['App.LNK', '*.lnk', true],
    ['readme.md', 'README*', true],
    ['a.txt', '*.pdf', false],
  ])('%s と %s は %s（大文字・小文字を区別しない）', (name, pattern, expected) => {
    expect(matchesDirPattern(name, pattern)).toBe(expected);
  });
});

describe('appendExcludeName（フォルダ取込の除外にファイル名を足す）', () => {
  it('空ならそのファイル名だけになる', () => {
    expect(appendExcludeName(undefined, 'memo.txt')).toBe('memo.txt');
    expect(appendExcludeName('  ', 'memo.txt')).toBe('memo.txt');
  });

  it('今の値と { } でまとめ、両方に当たる', () => {
    const pattern = appendExcludeName('*.tmp', 'memo.txt');
    expect(pattern).toBe('{*.tmp,memo.txt}');
    expect(minimatch('a.tmp', pattern)).toBe(true);
    expect(minimatch('memo.txt', pattern)).toBe(true);
    expect(minimatch('other.txt', pattern)).toBe(false);
  });

  it('全体が { } のときは中に足す（入れ子の { } は崩さない）', () => {
    expect(appendExcludeName('{*.tmp,old.txt}', 'memo.txt')).toBe('{*.tmp,old.txt,memo.txt}');
    const nested = appendExcludeName('*.{tmp,bak}', 'memo.txt');
    expect(nested).toBe('{*.{tmp,bak},memo.txt}');
    expect(minimatch('a.bak', nested)).toBe(true);
    expect(minimatch('memo.txt', nested)).toBe(true);
    // 先頭と末尾が別の組の { } なら、全体を囲み直す
    expect(appendExcludeName('{a,b}.{c,d}', 'x')).toBe('{{a,b}.{c,d},x}');
  });

  it('すでに当たっていれば変えない', () => {
    expect(appendExcludeName('*.txt', 'memo.txt')).toBe('*.txt');
  });

  it('ワイルドカードや , { } を含む名前も、その名前だけに当たる', () => {
    for (const name of ['a,b (1).txt', 'x{y}.log', 'foo*.tmp', '[draft].md', '普通.txt']) {
      const pattern = appendExcludeName('*.zip', name);
      expect(minimatch(name, pattern)).toBe(true);
      expect(minimatch('other.txt', pattern)).toBe(false);
      expect(minimatch(name, escapeExcludeName(name))).toBe(true);
    }
    expect(minimatch('fooX.tmp', escapeExcludeName('foo*.tmp'))).toBe(false);
  });
});
