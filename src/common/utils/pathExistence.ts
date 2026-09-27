import { PathUtils } from './pathUtils';

/**
 * アイテムのパスを「実在するか」の確認対象にするか
 *
 * 対象外（確認しても意味がない、または誤って「見つからない」になる）:
 * - URL（`://` を含む）とカスタム URI スキーム（`ms-todo:` など）
 * - `shell:` で始まるシェルの特殊フォルダ
 * - 区切り文字を含まない裸のコマンド名（`notepad.exe` など。PATH から解決される）
 * - 空
 */
export function isPathExistenceCheckable(itemPath: string | undefined): boolean {
  if (!itemPath) return false;
  const trimmed = itemPath.trim();
  if (!trimmed) return false;
  if (trimmed.includes('://')) return false;
  if (trimmed.toLowerCase().startsWith('shell:')) return false;
  if (PathUtils.isCustomUriScheme(trimmed)) return false;
  if (!trimmed.includes('\\') && !trimmed.includes('/')) return false;
  return true;
}
