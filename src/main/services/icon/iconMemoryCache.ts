/**
 * アイコンのキャッシュファイルの中身（base64 の data URL）をメモリに覚える（A3-254 S2）
 *
 * 画面はアイテムを読み直すたびに全アイテムのアイコンをまとめて取りに来る。今まではそのたびに全ファイルを
 * ディスクから読んで base64 にしていた（3,000 件で 1.7 秒）。一度読んだファイルは中身を覚え、無かったファイルも
 * 「無い」と覚える。
 *
 * - QDL がキャッシュに書いたとき（rememberIconFile）・消したとき（forgetIconFile）に覚え直す
 * - F5・起動・「アイコンをすべて取り直す」・スナップショットから戻したときは全部捨てる（clearIconMemoryCache）。
 *   QDL の外でキャッシュのフォルダを消したり足したりしたときは、F5 で反映する（設定と同じ）
 */
import * as fs from 'fs';
import * as path from 'path';

import { FileUtils } from '@common/utils/fileUtils';

/** 覚えておく数の上限（超えたら全部捨てて覚え直す。アイコン 1 つ 2〜3KB なので 2 万件で 60MB ほど） */
const MAX_ENTRIES = 20_000;

/** ファイルのパス → data URL。null は「ファイルが無かった」 */
const cache = new Map<string, string | null>();

/** Windows のパスは大文字小文字を区別しないので、小文字にそろえて引く */
function keyOf(filePath: string): string {
  const normalized = path.normalize(filePath);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function put(filePath: string, value: string | null): void {
  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(keyOf(filePath), value);
}

/**
 * 候補のパスを順に見て、最初にあったファイルの data URL を返す（覚えていればディスクを読まない）
 */
export async function readFirstExistingIconCached(paths: string[]): Promise<string | null> {
  for (const p of paths) {
    const key = keyOf(p);
    if (cache.has(key)) {
      const remembered = cache.get(key) ?? null;
      if (remembered) return remembered;
      continue;
    }
    try {
      const buffer = await fs.promises.readFile(p);
      const dataUrl = FileUtils.bufferToBase64DataUrl(buffer);
      put(p, dataUrl);
      return dataUrl;
    } catch {
      // 無い候補は「無い」と覚えて次を試す
      put(p, null);
    }
  }
  return null;
}

/** QDL がキャッシュに書いたファイルの中身を覚える（書けなかったときは忘れる） */
export function rememberIconFile(filePath: string, dataUrl: string | null): void {
  if (dataUrl) put(filePath, dataUrl);
  else forgetIconFile(filePath);
}

/** ファイルを書き換えた・消したので、次はディスクから読む */
export function forgetIconFile(filePath: string): void {
  cache.delete(keyOf(filePath));
}

/** 覚えているものを全部捨てる */
export function clearIconMemoryCache(): void {
  cache.clear();
}

/** テスト用: 覚えている数 */
export function getIconMemoryCacheSizeForTest(): number {
  return cache.size;
}
