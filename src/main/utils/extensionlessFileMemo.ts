import * as fs from 'fs';

import logger from '@common/logger';

import PathManager from '../config/pathManager.js';

/**
 * 「拡張子が無いのにファイルだったパス」のメモ（path-type-cache.json）
 *
 * 種別はパスの文字列から決めるため、拡張子の無いパスはフォルダと判定される。`hosts` のような
 * 拡張子の無いファイルを見分けるには、ディスクで一度確かめた結果を残しておくしかない。
 * 起動時にディスクを読まずに済むよう、確かめた結果のうち例外（ファイルだったもの）だけを残す。
 * メモに無いパスは今までどおりフォルダとして扱う。
 *
 * Windows のパスは大文字・小文字を区別しないので、照合も区別しない（保存は最初に覚えた表記のまま）。
 * 書き換えるのは folderPathProbe（登録・編集・起動・F5・「アイコンをすべて取り直す」）だけ。
 */

export interface MemoStorage {
  read(): string[];
  write(paths: string[]): void;
}

const MEMO_VERSION = 1;

const fileStorage: MemoStorage = {
  read() {
    const filePath = PathManager.getPathTypeCacheFilePath();
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
      extensionlessFiles?: unknown;
    };
    return Array.isArray(parsed.extensionlessFiles)
      ? parsed.extensionlessFiles.filter((p): p is string => typeof p === 'string')
      : [];
  },
  write(paths) {
    const filePath = PathManager.getPathTypeCacheFilePath();
    const body = { version: MEMO_VERSION, extensionlessFiles: paths };
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2) + '\n', 'utf-8');
  },
};

let storage: MemoStorage = fileStorage;
/** 照合用のキー（小文字）→ 保存する表記 */
let memo: Map<string, string> | null = null;

const keyOf = (itemPath: string): string => itemPath.toLowerCase();

/** テスト用: 読み書き先を差し替える（null で既定のファイルに戻す）。覚えた内容も捨てる */
export function setExtensionlessFileMemoStorage(next: MemoStorage | null): void {
  storage = next ?? fileStorage;
  memo = null;
}

function load(): Map<string, string> {
  if (memo) return memo;
  memo = new Map();
  try {
    for (const p of storage.read()) memo.set(keyOf(p), p);
  } catch (error) {
    // 壊れていても困るのは表示だけなので、空から始める（次の書き込みで作り直される）
    logger.warn({ error }, '拡張子の無いファイルのメモを読めませんでした');
  }
  return memo;
}

function save(current: Map<string, string>): void {
  try {
    storage.write([...current.values()].sort());
  } catch (error) {
    logger.warn({ error }, '拡張子の無いファイルのメモを保存できませんでした');
  }
}

/** メモにある（＝拡張子が無いがファイルと分かっている）パスか */
export function isKnownExtensionlessFile(itemPath: string): boolean {
  return load().has(keyOf(itemPath));
}

/** メモにあるパスの一覧 */
export function getKnownExtensionlessFiles(): string[] {
  return [...load().values()];
}

/** 確かめた結果をメモに反映する。ファイルなら足し、フォルダ・存在しないなら消す */
export function rememberExtensionlessPath(itemPath: string, isFile: boolean): void {
  const current = load();
  const key = keyOf(itemPath);
  if (current.has(key) === isFile) return;
  if (isFile) {
    current.set(key, itemPath);
  } else {
    current.delete(key);
  }
  save(current);
}

/** keep に無いパスのメモを捨てる（データから消えたアイテムの分） */
export function pruneExtensionlessFileMemo(keep: Iterable<string>): void {
  const current = load();
  const keepKeys = new Set([...keep].map(keyOf));
  const stale = [...current.keys()].filter((key) => !keepKeys.has(key));
  if (stale.length === 0) return;
  for (const key of stale) current.delete(key);
  save(current);
}
