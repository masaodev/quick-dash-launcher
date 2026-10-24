import { minimatch } from 'minimatch';

/**
 * ファイル名を、フォルダ取込の除外フィルタ（minimatch のパターン）の中でそのまま 1 件に当たる形にする
 *
 * ワイルドカード（* ? [ ] ( ) など）に加え、まとめて書くときの { } , も文字として扱う
 */
export function escapeExcludeName(fileName: string): string {
  return minimatch.escape(fileName).replace(/[{},]/g, (c) => `\\${c}`);
}

/** パターン全体が 1 組の { } で囲まれているか（先頭の { と末尾の } が対になっているか） */
function isWholeBraceGroup(pattern: string): boolean {
  if (!pattern.startsWith('{') || !pattern.endsWith('}')) return false;
  let depth = 0;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '{') depth++;
    if (c === '}') depth--;
    if (depth === 0 && i < pattern.length - 1) return false;
  }
  return depth === 0;
}

/**
 * 除外フィルタにファイル名を 1 件足したパターンを返す（A3-158）
 *
 * - 空なら、そのファイル名だけ
 * - すでにそのファイル名に当たるなら、そのまま
 * - `{a,b}` の形なら中に足し、それ以外は `{今の値,ファイル名}` にまとめる（データの形は文字列 1 つのまま）
 */
export function appendExcludeName(current: string | undefined, fileName: string): string {
  const escaped = escapeExcludeName(fileName);
  const pattern = current?.trim() ?? '';
  if (!pattern) return escaped;
  if (minimatch(fileName, pattern)) return pattern;
  if (isWholeBraceGroup(pattern)) return `${pattern.slice(0, -1)},${escaped}}`;
  return `{${pattern},${escaped}}`;
}
