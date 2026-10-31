/**
 * ファイル形式の版を比べる（データファイル・ワークスペース・設定・QDL が管理する小さなファイル共通）
 *
 * 版の書き方はファイルごとに違う（データファイル "1.0"・ワークスペース "2.0" は文字列、
 * item-usage.json・path-type-cache.json は数値の 1）。書いてある形は変えずに、ここで同じ規則で比べる。
 *
 * 自分（この QDL）が扱える版より新しいファイルは、新しい版の QDL が書いたもの。読んで使ってよいが、
 * 書き戻すと新しい版の形を壊すので書かない（docs/architecture/file-formats/README.md「形式の版と互換」）。
 */

/** ファイルに書く版（"1.0" のような文字列か、1 のような数値） */
export type FormatVersion = string | number;

/**
 * 版を数の並びにする（"2.1" → [2, 1]、1 → [1]）
 *
 * @returns 版として読めなければ null（文字列は「0 以上の整数をドットでつないだもの」だけ）
 */
export function parseFormatVersion(value: unknown): number[] | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? [value] : null;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)*$/.test(trimmed)) return null;
  return trimmed.split('.').map(Number);
}

/**
 * 2 つの版を比べる。足りない桁は 0 とみなす（"2" と "2.0" と 2 は同じ）
 *
 * @returns a が新しければ正、古ければ負、同じなら 0
 */
export function compareFormatVersions(a: readonly number[], b: readonly number[]): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * ファイルの版が、この QDL が扱える版より新しいか
 *
 * 版が無い・版として読めないときは false（今までどおり、読み込みで補う・直す）
 *
 * @param fileVersion - ファイルに書いてある版（未検証の値）
 * @param supported - この QDL が書く版
 */
export function isNewerFormatVersion(fileVersion: unknown, supported: FormatVersion): boolean {
  const file = parseFormatVersion(fileVersion);
  const own = parseFormatVersion(supported);
  if (file === null || own === null) return false;
  return compareFormatVersions(file, own) > 0;
}
