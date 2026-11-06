/**
 * ショートカット（.lnk）を読んだ結果をメモリに覚える（A3-254 S4）
 *
 * `shell.readShortcutLink` とリンク先の確認は同期の呼び出しで、1 個あたり数 ms かかる（本番のデータでは
 * .lnk 52 個のフォルダ取込 1 件で 285ms。読み直しにかかる時間の 7 割）。保存・取込のたびの読み直しで同じ .lnk を
 * 読まないよう、.lnk のパス・更新時刻・大きさが同じなら前に読んだ結果を使う。
 *
 * - .lnk を書き換えると更新時刻か大きさが変わるので、読み直す
 * - リンク先を消した・作ったことは .lnk に現れないので、起動・F5・「アイコンをすべて取り直す」で全部捨てる
 *   （clearShortcutCache。アイコンの写しと同じ）
 */
import * as fs from 'fs';
import * as path from 'path';

/** .lnk から読んだもの（アイテムの組み立ては呼び出し元が行う） */
export interface ShortcutInfo {
  target: string;
  args?: string;
  /** リンク先があるか */
  targetExists: boolean;
  /** リンク先がフォルダか（無ければ false） */
  targetIsDirectory: boolean;
}

/** 覚えておく数の上限（超えたら全部捨てて覚え直す） */
const MAX_ENTRIES = 20_000;

const cache = new Map<string, { mtimeMs: number; size: number; info: ShortcutInfo | null }>();

function keyOf(filePath: string): string {
  const normalized = path.normalize(filePath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/**
 * .lnk を読む（同じ中身のまま前に読んでいれば、覚えた結果を返す）
 * @param read 実際に読む処理（shell.readShortcutLink とリンク先の確認）。リンク先が無い .lnk は null
 * @returns 読めなければ null。.lnk 自体を見られなければ（消えたなど）覚えずに read の結果を返す
 */
export function readShortcutCached(
  filePath: string,
  read: (filePath: string) => ShortcutInfo | null,
  /** 呼び出し元が取ってある stat（フォルダ取込の走査）。無ければここで同期で取る */
  knownStat?: fs.Stats
): ShortcutInfo | null {
  let stat: fs.Stats;
  try {
    stat = knownStat ?? fs.statSync(filePath);
  } catch {
    return read(filePath);
  }
  const key = keyOf(filePath);
  const remembered = cache.get(key);
  if (remembered && remembered.mtimeMs === stat.mtimeMs && remembered.size === stat.size) {
    return remembered.info;
  }
  const info = read(filePath);
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, { mtimeMs: stat.mtimeMs, size: stat.size, info });
  return info;
}

/** 覚えているものを全部捨てる（起動・F5・「アイコンをすべて取り直す」） */
export function clearShortcutCache(): void {
  cache.clear();
}
