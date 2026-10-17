import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ shell: { readShortcutLink: vi.fn() } }));

import { applyPrefixSuffix } from './directoryScanner';

describe('applyPrefixSuffix', () => {
  it('入力したとおりの文字を前後に付け、区切りや括弧は足さない', () => {
    expect(applyPrefixSuffix('img0.jpg', '【壁紙】', '（Windows 標準）')).toBe(
      '【壁紙】img0.jpg（Windows 標準）'
    );
  });

  it('区切りを付けたいときは、入力に含める', () => {
    expect(applyPrefixSuffix('memo.txt', '仕事: ', ' (Dev)')).toBe('仕事: memo.txt (Dev)');
  });

  it('指定が無ければ名前のまま', () => {
    expect(applyPrefixSuffix('memo.txt')).toBe('memo.txt');
    expect(applyPrefixSuffix('memo.txt', '', '')).toBe('memo.txt');
  });
});
