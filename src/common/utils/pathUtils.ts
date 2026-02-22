import type { LauncherItem } from '@common/types';

/** パスの最後のセパレータ位置を取得 */
function lastSeparatorIndex(filePath: string): number {
  return Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
}

/** パス操作の共通ユーティリティ */
export class PathUtils {
  /** アイテムのフルパス（引数を含む）を取得 */
  static getFullPath(item: LauncherItem): string {
    return item.args ? `${item.path} ${item.args}` : item.path;
  }

  /** ファイルパスから親ディレクトリのパスを取得 */
  static getParentPath(filePath: string): string {
    const index = lastSeparatorIndex(filePath);
    return index > 0 ? filePath.substring(0, index) : '';
  }

  /** パスがショートカットファイル（.lnk）かどうかを判定 */
  static isShortcutFile(filePath?: string): boolean {
    return filePath?.toLowerCase().endsWith('.lnk') ?? false;
  }

  /** ファイルパスからファイル名を取得 */
  static getFileName(filePath: string): string {
    const index = lastSeparatorIndex(filePath);
    return index !== -1 ? filePath.substring(index + 1) : filePath;
  }

  /** ファイルパスから拡張子を取得（ドット含む、小文字） */
  static getExtension(filePath: string): string {
    const fileName = this.getFileName(filePath);
    const lastDot = fileName.lastIndexOf('.');
    return lastDot !== -1 ? fileName.substring(lastDot).toLowerCase() : '';
  }
}
