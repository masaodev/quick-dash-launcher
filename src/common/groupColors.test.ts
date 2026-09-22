import { describe, it, expect } from 'vitest';

import {
  GROUP_COLOR_PALETTE,
  GROUP_COLOR_TOKENS,
  getDefaultGroupColor,
  isValidGroupColor,
  resolveGroupColorCss,
} from './groupColors';

describe('groupColors', () => {
  it('パレットはトークンをすべて 1 回ずつ含むこと', () => {
    expect(GROUP_COLOR_PALETTE.map((p) => p.token).sort()).toEqual([...GROUP_COLOR_TOKENS].sort());
  });

  it('isValidGroupColor はトークンと 6 桁 hex だけを許すこと', () => {
    expect(isValidGroupColor('primary')).toBe(true);
    expect(isValidGroupColor('#00897b')).toBe(true);
    expect(isValidGroupColor('#00897B')).toBe(true);
    expect(isValidGroupColor('var(--color-primary)')).toBe(false);
    expect(isValidGroupColor('#fff')).toBe(false);
    expect(isValidGroupColor('')).toBe(false);
    expect(isValidGroupColor(undefined)).toBe(false);
  });

  it('getDefaultGroupColor は深さごとの既定色を返し、深すぎればプライマリに落ちること', () => {
    expect(getDefaultGroupColor(0)).toBe('primary');
    expect(getDefaultGroupColor(1)).toBe('teal');
    expect(getDefaultGroupColor(2)).toBe('secondary');
    expect(getDefaultGroupColor(9)).toBe('primary');
  });

  it('resolveGroupColorCss はトークンを CSS 変数に、hex はそのまま、不明な値はプライマリにすること', () => {
    expect(resolveGroupColorCss('teal')).toBe('var(--group-color-teal)');
    expect(resolveGroupColorCss('#9c27b0')).toBe('#9c27b0');
    // 未移行の旧形式（CSS 変数名）も描画は崩さない
    expect(resolveGroupColorCss('var(--color-success)')).toBe('var(--color-success)');
    expect(resolveGroupColorCss('')).toBe('var(--group-color-primary)');
    expect(resolveGroupColorCss(undefined)).toBe('var(--group-color-primary)');
  });
});
