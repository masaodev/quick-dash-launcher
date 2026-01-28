/**
 * アイテムタイプ検出ユーティリティ
 *
 * アイテムのパスからタイプ（URL、ファイル、フォルダ、アプリケーション、カスタムURI）を検出します。
 * クライアント側とサーバー側の両方で使用できるように設計されています。
 */

import type { LauncherItem } from '../types';

import { PathUtils } from './pathUtils';

/** 実行可能ファイルの拡張子 */
const EXECUTABLE_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.com', '.lnk']);

/** 標準的なURLスキーマ */
const STANDARD_URL_SCHEMES = new Set(['http', 'https', 'ftp']);

/**
 * パスのパターンのみでタイプを判定する（共通ロジック）
 */
function detectTypeFromPath(itemPath: string): LauncherItem['type'] {
  // URLs
  if (itemPath.includes('://')) {
    const scheme = itemPath.split('://')[0];
    return STANDARD_URL_SCHEMES.has(scheme) ? 'url' : 'customUri';
  }

  // Shell paths
  if (itemPath.startsWith('shell:')) {
    return 'folder';
  }

  const ext = PathUtils.getExtension(itemPath);

  // Executables and shortcuts
  if (EXECUTABLE_EXTENSIONS.has(ext)) {
    return 'app';
  }

  // Likely a directory (no extension or ends with separator)
  if (!ext || itemPath.endsWith('/') || itemPath.endsWith('\\')) {
    return 'folder';
  }

  return 'file';
}

/**
 * アイテムのパスからタイプを検出する（クライアント側用）
 *
 * ファイルシステムへの問い合わせを行い、より正確なタイプ検出を実行します。
 *
 * @param itemPath - アイテムのパス
 * @param isDirectoryCheck - ディレクトリかどうかを確認する非同期関数（オプション）
 * @returns アイテムタイプ
 *
 * @example
 * const type = await detectItemType(
 *   'C:\\Users\\Documents',
 *   window.electronAPI.isDirectory
 * );
 */
export async function detectItemType(
  itemPath: string,
  isDirectoryCheck?: (path: string) => Promise<boolean>
): Promise<LauncherItem['type']> {
  // URLやシェルパスは早期リターン
  if (itemPath.includes('://') || itemPath.startsWith('shell:')) {
    return detectTypeFromPath(itemPath);
  }

  // ディレクトリチェック（提供されている場合のみ）
  if (isDirectoryCheck) {
    try {
      const isDirectory = await isDirectoryCheck(itemPath);
      if (isDirectory) {
        return 'folder';
      }
    } catch (error) {
      console.error('Error checking if directory:', error);
    }
  }

  return detectTypeFromPath(itemPath);
}

/**
 * アイテムのパスからタイプを検出する（同期版、サーバー側用）
 *
 * ファイルシステムへの問い合わせを行わず、パスのパターンのみでタイプを判定します。
 * メインプロセスなど、同期的な処理が必要な場所で使用します。
 *
 * @param itemPath - アイテムのパス
 * @returns アイテムタイプ
 *
 * @example
 * const type = detectItemTypeSync('C:\\Program Files\\app.exe');
 */
export function detectItemTypeSync(itemPath: string): LauncherItem['type'] {
  return detectTypeFromPath(itemPath);
}
