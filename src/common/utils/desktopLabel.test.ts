import { describe, it, expect } from 'vitest';

import { desktopLabel } from './desktopLabel';

describe('desktopLabel', () => {
  it('名前があれば「番号: 名前」、無ければ番号だけ', () => {
    expect(desktopLabel(2, { 2: '仕事' })).toBe('2: 仕事');
    expect(desktopLabel(3, { 2: '仕事' })).toBe('3');
    expect(desktopLabel(1)).toBe('1');
    expect(desktopLabel(2, { 2: '  ' })).toBe('2');
  });

  it('番号を繰り返しているだけの名前は出さない（全角・空白・英語も）', () => {
    expect(desktopLabel(1, { 1: 'デスクトップ １' })).toBe('1');
    expect(desktopLabel(1, { 1: 'デスクトップ1' })).toBe('1');
    expect(desktopLabel(2, { 2: 'Desktop 2' })).toBe('2');
    expect(desktopLabel(2, { 2: 'デスクトップ 3' })).toBe('2: デスクトップ 3');
  });
});
