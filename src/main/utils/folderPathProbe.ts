import * as fs from 'fs';

import type { LauncherItem } from '@common/types';
import { detectItemTypeSync, type PathKind } from '@common/utils/itemTypeDetector';

import { expandEnvironmentVariables } from '../services/icon/iconFileCache.js';

import { runWithConcurrency } from './concurrency.js';
import {
  getKnownExtensionlessFiles,
  isKnownExtensionlessFile,
  pruneExtensionlessFileMemo,
  rememberExtensionlessPath,
} from './extensionlessFileMemo.js';

/**
 * パスの見た目と実際の種類が食い違うものを、ディスクに問い合わせて見分ける
 *
 * 種別はパスの文字列から決める（detectItemTypeSync）ため、次の 2 つを取り違える。
 * - `j-gate3.0` のようにドットを含むフォルダ名 → 拡張子つきのファイルと判定される
 * - `hosts` のように拡張子の無いファイル → フォルダと判定される
 *
 * ドット入りのフォルダ名:
 * - 登録・編集時: ローカル・ネットワークとも確かめ、フォルダなら末尾に区切り文字を付けて保存する
 *   （末尾が区切り文字のパスはフォルダと判定されるので、以後の読み込みでディスクを見なくてよい）
 * - 読み込み時: ドライブ文字で始まるパスだけ確かめる（`\\server\...` は応答待ちを避けて確かめない）
 *
 * 拡張子の無いファイル（パスに印を付けられないので、extensionlessFileMemo に残す）:
 * - 登録・編集時と起動時: ローカル・ネットワークとも確かめてメモを書き換える
 * - 読み込み時: メモを見るだけでディスクは読まない
 * - F5: メモにあるパスだけ確かめ直す／「アイコンをすべて取り直す」: 拡張子の無いパスをすべて確かめてメモを作り直す
 *   （どちらもドライブ文字で始まるパスだけ）
 *
 * 割り当てたネットワークドライブや外したドライブはドライブ文字でも応答しないことがあるので、
 * 確認は時間切れつきの非同期で行い、結果はアプリを起動しているあいだ覚えておく
 */

/** 確認結果。unknown は時間切れ（判定は変えない） */
type ProbeResult = PathKind | 'unknown';

/**
 * 読み込みの種類
 * - normal: アプリ内の変更に伴う再読込（覚えた結果を使う）
 * - recheck: 起動時・F5（覚えた結果を捨て、拡張子の無いファイルのメモにあるパスを確かめ直す）
 * - rebuild: 「アイコンをすべて取り直す」（覚えた結果を捨て、拡張子の無いパスをすべて確かめてメモを作り直す）
 */
export type LoadProbeMode = 'normal' | 'recheck' | 'rebuild';

const LOAD_TIMEOUT_MS = 1000;
const REGISTER_TIMEOUT_MS = 3000;
const CONCURRENCY = 8;

const probeCache = new Map<string, ProbeResult>();

/** 読み込みのあいだの種類（beginLoadProbeSession〜endLoadProbeSession） */
let sessionMode: LoadProbeMode | null = null;

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

/** 見た目ではフォルダだが、拡張子の無いファイルかもしれないパス（末尾の区切り文字が無いもの） */
function isExtensionlessCandidate(
  itemPath: string,
  detected: LauncherItem['type'] = detectItemTypeSync(itemPath)
): boolean {
  return (
    detected === 'folder' &&
    !endsWithSeparator(itemPath) &&
    (isDrivePath(itemPath) || isUncPath(itemPath))
  );
}

async function probe(itemPath: string, options: ProbeOptions): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? LOAD_TIMEOUT_MS;
  const stat = options.stat ?? ((p: string) => fs.promises.stat(p));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ProbeResult>((resolve) => {
    timer = setTimeout(() => resolve('unknown'), timeoutMs);
  });
  const check = stat(expandEnvironmentVariables(itemPath)).then(
    (stats) => (stats.isDirectory() ? ('folder' as const) : ('file' as const)),
    () => 'missing' as const
  );
  try {
    return await Promise.race([check, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 確認結果を覚え、拡張子の無いパスならメモにも反映する（時間切れはメモを変えない） */
function record(itemPath: string, result: ProbeResult): void {
  probeCache.set(itemPath, result);
  if (result !== 'unknown' && isExtensionlessCandidate(itemPath)) {
    rememberExtensionlessPath(itemPath, result === 'file');
  }
}

/**
 * 読み込み時の確認対象か
 * - パスの見た目がファイルで、ドライブ文字で始まるもの（ドット入りのフォルダ名）
 * - 「アイコンをすべて取り直す」のときだけ、拡張子の無いドライブ文字のパスも
 */
function needsLoadProbe(itemPath: string, detected: LauncherItem['type']): boolean {
  if (!isDrivePath(itemPath)) return false;
  if (detected === 'file') return true;
  return sessionMode === 'rebuild' && isExtensionlessCandidate(itemPath, detected);
}

/**
 * 読み込み（データファイル＋ワークスペース）の前に呼ぶ
 *
 * recheck・rebuild では覚えた結果を捨てる。recheck では拡張子の無いファイルのメモにあるパスを
 * 確かめ直す（消えた・フォルダに変わったものをメモから外す）。
 */
export async function beginLoadProbeSession(
  mode: LoadProbeMode,
  options: ProbeOptions = {}
): Promise<void> {
  sessionMode = mode;
  if (mode === 'normal') return;
  clearFolderProbeCache();
  if (mode === 'recheck') {
    const targets = getKnownExtensionlessFiles().filter(isDrivePath);
    await runWithConcurrency(
      targets.map((p) => async () => record(p, await probe(p, options))),
      CONCURRENCY
    );
  }
}

/**
 * 読み込みの後に呼ぶ
 *
 * 読み込んだアイテムのパス（データファイル・ワークスペース・アーカイブのすべて）を渡すと、
 * それに無いパスのメモを捨てる。読めなかったファイルがあるときは null を渡す
 * （そのファイルのアイテムの分まで捨てないため）
 */
export function endLoadProbeSession(loadedPaths: Iterable<string> | null): void {
  sessionMode = null;
  if (loadedPaths) pruneExtensionlessFileMemo(loadedPaths);
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
  await runWithConcurrency(
    targets.map((p) => async () => record(p, await probe(p, options))),
    CONCURRENCY
  );
}

/**
 * パスから決めた種別に、拡張子の無いファイルのメモを当てる（ディスクは読まない）
 */
export function applyExtensionlessFileMemo(
  itemPath: string,
  detected: LauncherItem['type'] = detectItemTypeSync(itemPath)
): LauncherItem['type'] {
  return isExtensionlessCandidate(itemPath, detected) && isKnownExtensionlessFile(itemPath)
    ? 'file'
    : detected;
}

/**
 * 読み込み時: パスから決めた種別を、ディスクの状態とメモで補正する
 *
 * prefetchFolderProbes で覚えた結果を使う。覚えていなければその場で確かめる
 */
export async function refineItemType(
  itemPath: string,
  detected: LauncherItem['type'] = detectItemTypeSync(itemPath),
  options: ProbeOptions = {}
): Promise<LauncherItem['type']> {
  if (needsLoadProbe(itemPath, detected)) {
    let result = probeCache.get(itemPath);
    if (result === undefined) {
      result = await probe(itemPath, options);
      record(itemPath, result);
    }
    if (detected === 'file') return result === 'folder' ? 'folder' : detected;
  }
  return applyExtensionlessFileMemo(itemPath, detected);
}

/**
 * 登録・編集時: パスの見た目ではフォルダと分からない実在のフォルダに、末尾の区切り文字を付ける
 *
 * ネットワークパス（`\\server\...`）も確かめる。時間切れ・存在しないときはそのまま返す。
 * 拡張子の無いパスは、ファイルかどうかを確かめてメモに残す（パスはそのまま）
 */
export async function withFolderMarker(
  itemPath: string,
  options: ProbeOptions = {}
): Promise<string> {
  if (!itemPath || endsWithSeparator(itemPath)) return itemPath;
  if (!isDrivePath(itemPath) && !isUncPath(itemPath)) return itemPath;
  const detected = detectItemTypeSync(itemPath);
  if (detected !== 'file' && detected !== 'folder') return itemPath;

  // 拡張子の無いパスはほとんどが普通のフォルダなので、応答しないときに保存を長く待たせない
  const timeoutMs = detected === 'folder' ? LOAD_TIMEOUT_MS : REGISTER_TIMEOUT_MS;
  const result = await probe(itemPath, { timeoutMs, ...options });
  record(itemPath, result);
  return detected === 'file' && result === 'folder' ? appendSeparator(itemPath) : itemPath;
}

/**
 * 起動時: 拡張子の無いパスなら、ファイルかどうかを確かめてメモに残す
 *
 * 起動の処理は待たせない（呼び出し側は await しなくてよい）。次の読み込みから種別に反映される
 */
export async function noteLaunchedPath(
  itemPath: string,
  options: ProbeOptions = {}
): Promise<void> {
  if (!isExtensionlessCandidate(itemPath)) return;
  record(itemPath, await probe(itemPath, { timeoutMs: REGISTER_TIMEOUT_MS, ...options }));
}

/**
 * パスが実在するフォルダ・ファイル・存在しない（または応答しない）のどれかを返す（登録画面へのドロップ）
 */
export async function getPathKind(itemPath: string, options: ProbeOptions = {}): Promise<PathKind> {
  const result = await probe(itemPath, { timeoutMs: REGISTER_TIMEOUT_MS, ...options });
  return result === 'unknown' ? 'missing' : result;
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
