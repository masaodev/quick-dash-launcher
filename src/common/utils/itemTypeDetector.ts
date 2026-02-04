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
 * ファイルシステムへの問い合わせを行い、より正確なタイプ検出を実行します。
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
 * パスのパターンのみでタイプを判定します（ファイルシステムへの問い合わせなし）。
 */
export function detectItemTypeSync(itemPath: string): LauncherItem['type'] {
  return detectTypeFromPath(itemPath);
}
