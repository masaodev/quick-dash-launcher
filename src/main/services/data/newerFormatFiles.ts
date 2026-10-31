import { isRecord } from '@common/types/guards';
import { JSON_DATA_VERSION } from '@common/types';
import { JSON_WORKSPACE_VERSION } from '@common/types/json-workspace';
import { isNewerFormatVersion } from '@common/utils/formatVersion';
import type { FileFormatKind } from '@common/utils/unknownKeys';

/**
 * 新しい版の QDL が保存した（この QDL が扱える版より新しい）データファイル・ワークスペースファイルの集合
 *
 * 読んで表示はするが、書き戻すと新しい版の形を壊すので書かない（writeDataFile が拒否する）。
 * キーは設定フォルダからの相対パス（'datafiles/data2.json'・'workspace.json'）。
 * 読み込みで版が扱える範囲に戻っていれば外す（新しい版で戻した・ファイルを差し替えた）。
 */
const newerFormatFiles = new Set<string>();

/** この QDL が書く形式の版 */
const SUPPORTED_VERSION: Record<FileFormatKind, string> = {
  data: JSON_DATA_VERSION,
  workspace: JSON_WORKSPACE_VERSION,
};

/** ファイルの中身（JSON.parse したもの）の version が、この QDL が扱える版より新しいか */
export function isNewerFormatFile(kind: FileFormatKind, raw: unknown): boolean {
  return isRecord(raw) && isNewerFormatVersion(raw.version, SUPPORTED_VERSION[kind]);
}

export function markNewerFormatFile(fileKey: string): void {
  newerFormatFiles.add(fileKey);
}

export function clearNewerFormatFile(fileKey: string): void {
  newerFormatFiles.delete(fileKey);
}

/** 新しい版の QDL が保存したファイル（相対パス） */
export function getNewerFormatFiles(): string[] {
  return [...newerFormatFiles];
}

/** 新しい版の QDL が保存したデータファイル（datafiles/ の下だけ） */
export function getNewerFormatDataFiles(): string[] {
  return getNewerFormatFiles().filter((key) => key.startsWith('datafiles/'));
}

/** テスト用: 集合を空にする */
export function resetNewerFormatFilesForTesting(): void {
  newerFormatFiles.clear();
}
