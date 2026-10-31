import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { restoreUnknownKeys } from '@common/utils/unknownKeys';
import type { FileFormatKind, UnknownKeySources } from '@common/utils/unknownKeys';

import { PathManager } from '../config/pathManager.js';

import { isNewerFormatFile, markNewerFormatFile } from './data/newerFormatFiles.js';

/**
 * データファイルの「QDL が最後に読んだ／書いた内容」を覚えておくトラッカー
 *
 * 外部（人や AI）による直接編集を、次の読み込み時に検知するために使う。
 * QDL 自身の書き込みは必ず writeDataFile() を通し、内容を記憶する。
 * これにより「記憶と違う内容を読んだ ＝ 外部で変更された」と判定できる。
 *
 * ファイル監視はしない（反映は F5 か再起動時のみ、という方針）。
 */

/** キー: 設定フォルダからの相対パス（例: 'datafiles/data.json'） */
const knownContents = new Map<string, string>();

/**
 * 絶対パスをトラッカーのキー（設定フォルダからの相対パス、'/' 区切り）に変換する
 */
export function toDataFileKey(filePath: string): string {
  const relative = path.relative(PathManager.getConfigFolder(), filePath);
  return relative.split(path.sep).join('/');
}

/**
 * 内容のハッシュ（楽観ロックの比較用）
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha1').update(content, 'utf8').digest('hex');
}

/**
 * 読み込んだ／書き込んだ内容を記憶する
 */
export function rememberDataFileContent(fileName: string, content: string): void {
  knownContents.set(fileName, content);
}

/**
 * 記憶から外す（ファイル削除時）
 */
export function forgetDataFile(fileName: string): void {
  knownContents.delete(fileName);
}

/**
 * 外部変更を検知する
 *
 * @returns 記憶している内容と違えば、その「変更前の内容」。初回（記憶なし）や同一なら null
 */
export function detectExternalChange(fileName: string, currentContent: string): string | null {
  const previous = knownContents.get(fileName);
  if (previous === undefined || previous === currentContent) {
    return null;
  }
  return previous;
}

/** 書き込みのオプション */
export interface WriteDataFileOptions {
  /**
   * 知らない項目を付け直す元（unknownKeys.ts）。省略するとディスク上の今の内容から作る。
   * 複数のファイルを続けて書くとき（移す元を先に書く場合）は、書き始める前に読んだ内容を渡す
   */
  unknownKeySources?: UnknownKeySources;
}

/** 設定フォルダからの相対パスから、知らない項目を付け直す対象のファイルの種類を決める（対象外なら null） */
export function fileFormatKindOf(fileKey: string): FileFormatKind | null {
  if (fileKey === 'workspace.json' || fileKey === 'workspace-archive.json') return 'workspace';
  if (fileKey.startsWith('datafiles/')) return 'data';
  return null;
}

/** ファイルの内容を JSON として読む（BOM 付きでも読む）。無い・読めない・壊れていれば undefined */
export function readJsonForCompat(filePath: string): unknown {
  const content = FileUtils.safeReadTextFile(filePath);
  if (content === null) return undefined;
  try {
    return JSON.parse(content.charCodeAt(0) === 0xfeff ? content.slice(1) : content);
  } catch {
    return undefined;
  }
}

/**
 * 知らない項目を付け直す元を、ディスク上の今の内容から作る
 *
 * データファイルはほかのデータファイルからアイテムが移ってくる（id はファイル横断で一意）ので、
 * ほかのデータファイルも元にする。ワークスペースは workspace.json と workspace-archive.json の間で移る
 */
export function readUnknownKeySources(filePath: string): UnknownKeySources {
  const folder = path.dirname(filePath);
  const self = path.basename(filePath);
  const others =
    fileFormatKindOf(toDataFileKey(filePath)) === 'workspace'
      ? ['workspace.json', 'workspace-archive.json']
      : listDataFileNames(folder);
  return {
    target: readJsonForCompat(filePath),
    others: others
      .filter((name) => name !== self)
      .map((name) => readJsonForCompat(path.join(folder, name))),
  };
}

/** フォルダ内のデータファイル名（PathManager.getDataFiles と同じ規則。読めなければ空） */
function listDataFileNames(folder: string): string[] {
  try {
    return fs
      .readdirSync(folder)
      .filter((name) => name.startsWith('data') && name.endsWith('.json'));
  } catch {
    return [];
  }
}

/**
 * 書く内容に、ディスク上の今の内容が持っていた知らない項目（新しい版の QDL が足した項目）を付け直す
 *
 * writeDataFile も中で呼ぶ。書いた内容のハッシュを使う呼び出し側（楽観ロック）は、先にこれで内容を確定させてから書く。
 * データファイル・ワークスペースファイル以外と、JSON として読めない内容はそのまま返す
 */
export function prepareDataFileContent(
  filePath: string,
  content: string,
  options: WriteDataFileOptions = {}
): string {
  const kind = fileFormatKindOf(toDataFileKey(filePath));
  if (!kind) return content;
  let next: unknown;
  try {
    next = JSON.parse(content);
  } catch {
    return content;
  }
  const sources = options.unknownKeySources ?? readUnknownKeySources(filePath);
  return restoreUnknownKeys(kind, next, sources) ? JSON.stringify(next, null, 2) : content;
}

/**
 * データファイルをアトミックに書き込み、内容を記憶する
 *
 * QDL 自身によるデータファイルの書き込みは必ずここを通す。
 * 書く前に、ディスク上の今の内容が持っていた知らない項目を付け直す（prepareDataFileContent）。
 * ディスク上のファイルが新しい版の QDL で保存されたもの（扱える版より新しい）なら書かずに false を返す
 * （新しい版の形を壊さないため。どのファイルかは newerFormatFiles に残す）。
 */
export function writeDataFile(
  filePath: string,
  content: string,
  options: WriteDataFileOptions = {}
): boolean {
  const key = toDataFileKey(filePath);
  const kind = fileFormatKindOf(key);
  if (kind && isNewerFormatFile(kind, readJsonForCompat(filePath))) {
    markNewerFormatFile(key);
    dataLogger.warn(
      { filePath },
      '新しい版の QDL で保存されたファイルなので書き込みません（QDL を更新すると書けます）'
    );
    return false;
  }
  const output = prepareDataFileContent(filePath, content, options);
  const ok = FileUtils.safeWriteTextFile(filePath, output);
  if (ok) {
    rememberDataFileContent(toDataFileKey(filePath), output);
  } else {
    dataLogger.error({ filePath }, 'データファイルの書き込みに失敗しました');
  }
  return ok;
}

/** テスト用: 記憶をクリアする */
export function resetDataFileTrackerForTesting(): void {
  knownContents.clear();
}
