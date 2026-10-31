/**
 * クリップボードの実データ（clipboard-data/*.json）を、どこからも使われなくなったときだけ消す
 *
 * 同じ実データを複数のアイテムが指していることがある（#464 より前にワークスペースへ写したアイテム、
 * 保存先を変える編集の途中など）。アイテムを消したり本文を書き換えたりしたあと、ランチャーの
 * データファイル・workspace.json・workspace-archive.json のどれも指していない実データだけを消す。
 * どれかのファイルが読めないときは、使われているかを決められないので消さない
 */

import * as fs from 'fs';
import * as path from 'path';

import logger from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';

import { PathManager } from '../config/pathManager.js';

import { ClipboardService } from './clipboardService.js';

/** 実データを指すキー（clipboardDataRef はワークスペースの古い形式。読み込み時に dataFileRef へ移す） */
const DATA_REF_KEYS = new Set(['dataFileRef', 'clipboardDataRef']);

/** 保存してからこれより新しい実データは、片付けの対象にしない（登録の途中で、まだどのアイテムも指していない） */
const RECENT_DATA_MS = 10 * 60 * 1000;

function collectRefs(value: unknown, refs: Set<string>): void {
  if (Array.isArray(value)) {
    for (const v of value) collectRefs(v, refs);
  } else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (DATA_REF_KEYS.has(key) && typeof v === 'string') refs.add(v);
      else collectRefs(v, refs);
    }
  }
}

/** ファイルの中のアイテムが指している実データの参照（読めなければ空。データファイルを丸ごと消す前に控える） */
export function clipboardDataRefsInFile(filePath: string): string[] {
  const content = FileUtils.safeReadTextFile(filePath);
  if (content === null) return [];
  const refs = new Set<string>();
  try {
    collectRefs(JSON.parse(content), refs);
  } catch {
    return [];
  }
  return [...refs];
}

/**
 * ランチャーのデータファイル・ワークスペース・アーカイブが指している実データの参照
 *
 * @returns 読めないファイルがあれば null（使われているかを決められない）
 */
export function collectClipboardDataRefsInUse(configFolder: string): Set<string> | null {
  const files = [
    ...PathManager.getDataFiles().map((fileName) => path.join(configFolder, fileName)),
    PathManager.getWorkspaceFilePath(),
    PathManager.getWorkspaceArchiveFilePath(),
  ];
  const refs = new Set<string>();
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    const content = FileUtils.safeReadTextFile(filePath);
    if (content === null) return null;
    try {
      collectRefs(JSON.parse(content), refs);
    } catch (error) {
      logger.warn(
        { error, filePath },
        '読めないファイルがあるため、クリップボードの実データを消しません'
      );
      return null;
    }
  }
  return refs;
}

/**
 * 渡した実データのうち、どこからも使われなくなったものを消す
 *
 * アイテムを消した・本文を書き換えた書き込みのあとで呼ぶ（書き込みの前に呼ぶと、まだ使われているので消えない）
 */
export function releaseClipboardData(configFolder: string, refs: Iterable<string>): void {
  const candidates = [...new Set(refs)];
  if (candidates.length === 0) return;
  const inUse = collectClipboardDataRefsInUse(configFolder);
  if (!inUse) return;
  const clipboardService = ClipboardService.getInstance();
  for (const ref of candidates) {
    // deleteClipboardData は中で await しないので、呼んだ時点で消し終わっている
    if (!inUse.has(ref)) void clipboardService.deleteClipboardData(ref);
  }
}

/**
 * どこからも使われていない実データの参照（アイテム管理の「整理 ▼」の片付け）
 *
 * 保存して間もない実データは、登録の途中かもしれないので含めない
 *
 * @returns 読めないファイルがあれば null
 */
export function findUnusedClipboardData(
  configFolder: string,
  now: number = Date.now()
): string[] | null {
  const folder = PathManager.getClipboardDataFolder();
  if (!fs.existsSync(folder)) return [];
  const inUse = collectClipboardDataRefsInUse(configFolder);
  if (!inUse) return null;
  return fs
    .readdirSync(folder)
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({ file, ref: `clipboard-data/${file}` }))
    .filter(({ ref }) => !inUse.has(ref))
    .filter(({ file }) => now - fs.statSync(path.join(folder, file)).mtimeMs >= RECENT_DATA_MS)
    .map(({ ref }) => ref);
}
