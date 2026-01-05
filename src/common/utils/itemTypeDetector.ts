/**
 * アイテムタイプ検出ユーティリティ
 *
 * アイテムのパスからタイプ（URL、ファイル、フォルダ、アプリケーション、カスタムURI）を検出します。
 * クライアント側とサーバー側の両方で使用できるように設計されています。
 */

import type { LauncherItem } from '../types';
import { PathUtils } from './pathUtils';

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
 * // クライアント側での使用
 * const type = await detectItemType(
 *   'C:\\Users\\Documents',
 *   window.electronAPI.isDirectory
 * );
 */
export async function detectItemType(
  itemPath: string,
  isDirectoryCheck?: (path: string) => Promise<boolean>
): Promise<LauncherItem['type']> {
  // URLs
  if (itemPath.includes('://')) {
    const scheme = itemPath.split('://')[0];
    if (!['http', 'https', 'ftp'].includes(scheme)) {
      return 'customUri';
    }
    return 'url';
  }

  // Shell paths
  if (itemPath.startsWith('shell:')) {
    return 'folder';
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

  // File extensions - PathUtilsを使用して拡張子を取得
  const ext = PathUtils.getExtension(itemPath);

  // Executables and shortcuts
  if (ext === '.exe' || ext === '.bat' || ext === '.cmd' || ext === '.com' || ext === '.lnk') {
    return 'app';
  }

  // Check if it's likely a directory
  if (!ext || itemPath.endsWith('/') || itemPath.endsWith('\\')) {
    return 'folder';
  }

  // Default to file
  return 'file';
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
 * // サーバー側での使用
 * const type = detectItemTypeSync('C:\\Program Files\\app.exe');
 */
export function detectItemTypeSync(itemPath: string): LauncherItem['type'] {
  // URLs
  if (itemPath.includes('://')) {
    const scheme = itemPath.split('://')[0];
    if (!['http', 'https', 'ftp'].includes(scheme)) {
      return 'customUri';
    }
    return 'url';
  }

  // Shell paths
  if (itemPath.startsWith('shell:')) {
    return 'folder';
  }

  // File extensions - PathUtilsを使用して拡張子を取得
  const ext = PathUtils.getExtension(itemPath);

  // Executables and shortcuts
  if (ext === '.exe' || ext === '.bat' || ext === '.cmd' || ext === '.com' || ext === '.lnk') {
    return 'app';
  }

  // Check if it's likely a directory
  if (!ext || itemPath.endsWith('/') || itemPath.endsWith('\\')) {
    return 'folder';
  }

  // Default to file
  return 'file';
}
