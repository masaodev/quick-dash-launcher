import * as crypto from 'crypto';
import * as path from 'path';

import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';

import { PathManager } from '../config/pathManager.js';

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

/**
 * データファイルをアトミックに書き込み、内容を記憶する
 *
 * QDL 自身によるデータファイルの書き込みは必ずここを通す。
 */
export function writeDataFile(filePath: string, content: string): boolean {
  const ok = FileUtils.safeWriteTextFile(filePath, content);
  if (ok) {
    rememberDataFileContent(toDataFileKey(filePath), content);
  } else {
    dataLogger.error({ filePath }, 'データファイルの書き込みに失敗しました');
  }
  return ok;
}

/** テスト用: 記憶をクリアする */
export function resetDataFileTrackerForTesting(): void {
  knownContents.clear();
}
