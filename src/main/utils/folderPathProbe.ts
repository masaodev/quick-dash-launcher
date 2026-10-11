import * as fs from 'fs';

import type { LauncherItem } from '@common/types';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import { expandEnvironmentVariables } from '../services/icon/iconFileCache.js';

/**
 * 「パスの見た目ではファイルだが、実際はフォルダ」を見分ける
 *
 * 種別はパスの文字列から決める（detectItemTypeSync）ため、`j-gate3.0` のようにドットを含む
 * フォルダ名は拡張子つきのファイルと判定される。これをディスクに問い合わせて補う。
 *
 * - 登録・編集時: ローカル・ネットワークとも確かめ、フォルダなら末尾に区切り文字を付けて保存する
 *   （末尾が区切り文字のパスはフォルダと判定されるので、以後の読み込みでディスクを見なくてよい）
 * - 読み込み時: ドライブ文字で始まるパスだけ確かめる（`\\server\...` は応答待ちを避けて確かめない）
 *
 * 割り当てたネットワークドライブや外したドライブはドライブ文字でも応答しないことがあるので、
 * 確認は時間切れつきの非同期で行い、結果はアプリを起動しているあいだ覚えておく
 */

/** 確認結果。unknown は時間切れ（判定は変えない） */
type ProbeResult = 'folder' | 'notFolder' | 'unknown';

const LOAD_TIMEOUT_MS = 1000;
const REGISTER_TIMEOUT_MS = 3000;
const CONCURRENCY = 8;

const probeCache = new Map<string, ProbeResult>();

export interface ProbeOptions {
  timeoutMs?: number;
  /** テスト用: stat の実体（既定は fs.promises.stat） */
  stat?: (resolvedPath: string) => Promise<{ isDirectory(): boolean }>;
}

/** 読み込み時に覚えた結果を捨てる（F5 など、ディスクの今の状態で読み直したいとき） */
export function clearFolderProbeCache(): void {
  probeCache.clear();
}

function isDrivePath(itemPath: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(itemPath);
}

function isUncPath(itemPath: string): boolean {
  return /^[\\/]{2}[^\\/]/.test(itemPath);
}

function endsWithSeparator(itemPath: string): boolean {
  return itemPath.endsWith('\\') || itemPath.endsWith('/');
}

async function probe(itemPath: string, options: ProbeOptions): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? LOAD_TIMEOUT_MS;
  const stat = options.stat ?? ((p: string) => fs.promises.stat(p));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ProbeResult>((resolve) => {
    timer = setTimeout(() => resolve('unknown'), timeoutMs);
  });
  const check = stat(expandEnvironmentVariables(itemPath)).then(
    (stats) => (stats.isDirectory() ? ('folder' as const) : ('notFolder' as const)),
    () => 'notFolder' as const
  );
  try {
    return await Promise.race([check, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 読み込み時の確認対象か（パスの見た目がファイルで、ドライブ文字で始まるもの）
 */
function needsLoadProbe(itemPath: string, detected: LauncherItem['type']): boolean {
  return detected === 'file' && isDrivePath(itemPath);
}

async function runLimited<T>(values: T[], worker: (value: T) => Promise<void>): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, values.length) }, async () => {
    while (index < values.length) {
      await worker(values[index++]);
    }
  });
  await Promise.all(workers);
}

/**
 * 読み込み時: 確認が要るパスをまとめて確かめ、結果を覚えておく
 *
 * 1 件ずつ await すると応答しないドライブで時間切れが積み重なるため、先にまとめて並行で確かめる
 */
export async function prefetchFolderProbes(
  paths: string[],
  options: ProbeOptions = {}
): Promise<void> {
  const targets = [...new Set(paths)].filter(
    (p) => !probeCache.has(p) && needsLoadProbe(p, detectItemTypeSync(p))
  );
  await runLimited(targets, async (p) => {
    probeCache.set(p, await probe(p, options));
  });
}

/**
 * 読み込み時: パスから決めた種別を、ディスクの状態で補正する
 *
 * prefetchFolderProbes で覚えた結果を使う。覚えていなければその場で確かめる
 */
export async function refineItemType(
  itemPath: string,
  detected: LauncherItem['type'] = detectItemTypeSync(itemPath),
  options: ProbeOptions = {}
): Promise<LauncherItem['type']> {
  if (!needsLoadProbe(itemPath, detected)) return detected;
  let result = probeCache.get(itemPath);
  if (result === undefined) {
    result = await probe(itemPath, options);
    probeCache.set(itemPath, result);
  }
  return result === 'folder' ? 'folder' : detected;
}

/**
 * 登録・編集時: パスの見た目ではフォルダと分からない実在のフォルダに、末尾の区切り文字を付ける
 *
 * ネットワークパス（`\\server\...`）も確かめる。時間切れ・存在しないときはそのまま返す
 */
export async function withFolderMarker(
  itemPath: string,
  options: ProbeOptions = {}
): Promise<string> {
  if (!itemPath || endsWithSeparator(itemPath)) return itemPath;
  if (!isDrivePath(itemPath) && !isUncPath(itemPath)) return itemPath;
  if (detectItemTypeSync(itemPath) !== 'file') return itemPath;

  const result = await probe(itemPath, { timeoutMs: REGISTER_TIMEOUT_MS, ...options });
  if (result !== 'unknown') probeCache.set(itemPath, result);
  return result === 'folder' ? appendSeparator(itemPath) : itemPath;
}

/**
 * フォルダと分かっているパスに、見た目でもフォルダと分かるよう末尾の区切り文字を付ける
 *
 * 見た目でファイルと判定されるものだけが対象（`.lnk` などはそのまま）
 */
export function markKnownFolderPath(itemPath: string): string {
  return detectItemTypeSync(itemPath) === 'file' ? appendSeparator(itemPath) : itemPath;
}

function appendSeparator(itemPath: string): string {
  return itemPath + (itemPath.includes('/') && !itemPath.includes('\\') ? '/' : '\\');
}
