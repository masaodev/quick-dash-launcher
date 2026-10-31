/**
 * アプリの版（0.8.0・0.8.0-beta.29 の形）を比べ、GitHub のリリース一覧から知らせる版を選ぶ。
 * 更新の知らせ（updateCheckService）が使う。データファイルの形式の版（formatVersion）とは別物
 */

interface ParsedAppVersion {
  core: [number, number, number];
  /** プレリリースの部分（beta.29 → ['beta', 29]）。正式版は空 */
  pre: Array<string | number>;
}

/** 先頭の v を外して読む。読めなければ null */
export function parseAppVersion(value: string): ParsedAppVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    value.trim()
  );
  if (!match) return null;
  const pre = match[4]
    ? match[4].split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part))
    : [];
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre };
}

/** a が新しければ正、古ければ負、同じなら 0（semver の順。読めない版は最も古いとみなす） */
export function compareAppVersions(a: string, b: string): number {
  const pa = parseAppVersion(a);
  const pb = parseAppVersion(b);
  if (!pa || !pb) return (pa ? 1 : 0) - (pb ? 1 : 0);
  for (let i = 0; i < 3; i++) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i] - pb.core[i];
  }
  // 正式版は同じ番号のプレリリースより新しい
  if (pa.pre.length === 0 || pb.pre.length === 0) return pb.pre.length - pa.pre.length;
  for (let i = 0; i < Math.max(pa.pre.length, pb.pre.length); i++) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    if (typeof x === 'number') return -1;
    if (typeof y === 'number') return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export function isPrereleaseVersion(value: string): boolean {
  return (parseAppVersion(value)?.pre.length ?? 0) > 0;
}

/** GitHub の releases API の 1 件（使う項目だけ） */
export interface GitHubRelease {
  tag_name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
}

export interface AvailableRelease {
  /** 先頭の v を外した版 */
  version: string;
  /** リリースのページ */
  url: string;
}

/** 知らせてよいリリースのページか（API の返事をそのまま開かない） */
export function isReleasePageUrl(url: string, repository: string): boolean {
  return url.startsWith(`https://github.com/${repository}/releases/`);
}

/**
 * 今の版より新しいリリースのうち、いちばん新しいものを選ぶ。
 * 下書きは除く。プレリリースは includePrerelease のときだけ（ベータ版を使っている間は常に含める）
 */
export function pickAvailableRelease(
  releases: unknown,
  currentVersion: string,
  options: { includePrerelease: boolean; repository: string }
): AvailableRelease | null {
  if (!Array.isArray(releases)) return null;
  const includePrerelease = options.includePrerelease || isPrereleaseVersion(currentVersion);
  let best: AvailableRelease | null = null;
  for (const release of releases as GitHubRelease[]) {
    if (!release || typeof release !== 'object') continue;
    if (release.draft === true) continue;
    if (typeof release.tag_name !== 'string' || typeof release.html_url !== 'string') continue;
    if (!isReleasePageUrl(release.html_url, options.repository)) continue;
    const parsed = parseAppVersion(release.tag_name);
    if (!parsed) continue;
    const isPre = release.prerelease === true || parsed.pre.length > 0;
    if (isPre && !includePrerelease) continue;
    const version = release.tag_name.trim().replace(/^v/, '');
    if (compareAppVersions(version, currentVersion) <= 0) continue;
    if (!best || compareAppVersions(version, best.version) > 0) {
      best = { version, url: release.html_url };
    }
  }
  return best;
}
