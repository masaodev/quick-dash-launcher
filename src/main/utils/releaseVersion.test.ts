import { describe, expect, it } from 'vitest';

import { compareAppVersions, isPrereleaseVersion, pickAvailableRelease } from './releaseVersion';

const REPO = 'masaodev/quick-dash-launcher';
const release = (tag: string, extra: Record<string, unknown> = {}) => ({
  tag_name: tag,
  html_url: `https://github.com/${REPO}/releases/tag/${tag}`,
  draft: false,
  prerelease: tag.includes('-'),
  ...extra,
});

describe('compareAppVersions', () => {
  it.each([
    ['0.8.1', '0.8.0', 1],
    ['0.8.0', '0.8.0-beta.29', 1],
    ['0.8.0-beta.30', '0.8.0-beta.29', 1],
    ['0.8.0-beta.10', '0.8.0-beta.9', 1],
    ['v0.8.0', '0.8.0', 0],
    ['0.9.0-beta.1', '0.8.5', 1],
    ['1.0.0', '0.99.99', 1],
  ])('%s と %s', (a, b, sign) => {
    expect(Math.sign(compareAppVersions(a, b))).toBe(sign);
    expect(Math.sign(compareAppVersions(b, a))).toBe(sign === 0 ? 0 : -sign);
  });

  it('読めない版は最も古いとみなす', () => {
    expect(compareAppVersions('latest', '0.0.1')).toBeLessThan(0);
  });

  it('プレリリースかどうか', () => {
    expect(isPrereleaseVersion('0.8.0-beta.29')).toBe(true);
    expect(isPrereleaseVersion('0.8.0')).toBe(false);
  });
});

describe('pickAvailableRelease', () => {
  const releases = [
    release('v0.8.1-beta.1'),
    release('v0.8.0'),
    release('v0.8.0-beta.29'),
    release('v0.9.0', { draft: true }),
  ];

  it('正式版を使っている人には、新しい正式版だけを選ぶ（下書きは除く）', () => {
    expect(
      pickAvailableRelease(releases, '0.7.9', { includePrerelease: false, repository: REPO })
    ).toEqual({ version: '0.8.0', url: `https://github.com/${REPO}/releases/tag/v0.8.0` });
  });

  it('ベータ版を使っている間は、設定に関係なくベータ版も選ぶ', () => {
    expect(
      pickAvailableRelease(releases, '0.8.0-beta.29', {
        includePrerelease: false,
        repository: REPO,
      })?.version
    ).toBe('0.8.1-beta.1');
  });

  it('設定でベータ版も知らせるときは、正式版の人にもベータ版を選ぶ', () => {
    expect(
      pickAvailableRelease(releases, '0.8.0', { includePrerelease: true, repository: REPO })
        ?.version
    ).toBe('0.8.1-beta.1');
  });

  it('新しい版が無ければ null', () => {
    expect(
      pickAvailableRelease(releases, '0.8.0', { includePrerelease: false, repository: REPO })
    ).toBeNull();
  });

  it('リポジトリの外のページ・壊れた返事は使わない', () => {
    expect(
      pickAvailableRelease(
        [release('v9.0.0', { html_url: 'https://example.com/evil' }), { tag_name: 1 }, null],
        '0.8.0',
        { includePrerelease: false, repository: REPO }
      )
    ).toBeNull();
    expect(
      pickAvailableRelease({ message: 'rate limited' }, '0.8.0', {
        includePrerelease: false,
        repository: REPO,
      })
    ).toBeNull();
  });
});
