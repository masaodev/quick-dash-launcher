import { describe, expect, it } from 'vitest';

import { compareFormatVersions, isNewerFormatVersion, parseFormatVersion } from './formatVersion';

describe('parseFormatVersion', () => {
  it('文字列と数値の版を数の並びにする', () => {
    expect(parseFormatVersion('1.0')).toEqual([1, 0]);
    expect(parseFormatVersion('2.10')).toEqual([2, 10]);
    expect(parseFormatVersion(' 3 ')).toEqual([3]);
    expect(parseFormatVersion(1)).toEqual([1]);
  });

  it('版として読めないものは null', () => {
    expect(parseFormatVersion(undefined)).toBeNull();
    expect(parseFormatVersion('')).toBeNull();
    expect(parseFormatVersion('v2')).toBeNull();
    expect(parseFormatVersion('2.0-beta')).toBeNull();
    expect(parseFormatVersion(1.5)).toBeNull();
    expect(parseFormatVersion(-1)).toBeNull();
    expect(parseFormatVersion({})).toBeNull();
  });
});

describe('compareFormatVersions', () => {
  it('足りない桁は 0 とみなす', () => {
    expect(compareFormatVersions([2], [2, 0])).toBe(0);
    expect(compareFormatVersions([2, 1], [2])).toBeGreaterThan(0);
    expect(compareFormatVersions([1, 9], [2, 0])).toBeLessThan(0);
    expect(compareFormatVersions([2, 10], [2, 9])).toBeGreaterThan(0);
  });
});

describe('isNewerFormatVersion', () => {
  it('自分の版より新しいときだけ true', () => {
    expect(isNewerFormatVersion('2.1', '2.0')).toBe(true);
    expect(isNewerFormatVersion('3.0', '2.0')).toBe(true);
    expect(isNewerFormatVersion(2, 1)).toBe(true);
    expect(isNewerFormatVersion('2', 1)).toBe(true);
    expect(isNewerFormatVersion('2.0', '2.0')).toBe(false);
    expect(isNewerFormatVersion('1.0', '2.0')).toBe(false);
    expect(isNewerFormatVersion(1, '1.0')).toBe(false);
  });

  it('版が無い・読めないときは false（今までどおり補う）', () => {
    expect(isNewerFormatVersion(undefined, '1.0')).toBe(false);
    expect(isNewerFormatVersion('abc', '1.0')).toBe(false);
    expect(isNewerFormatVersion(null, 1)).toBe(false);
  });
});
