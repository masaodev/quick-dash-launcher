import type { LauncherItem } from '@common/types';

/** パス操作の共通ユーティリティ */
export class PathUtils {
  /** アイテムのフルパス（引数を含む）を取得 */
  static getFullPath(item: LauncherItem): string {
    return item.args ? `${item.path} ${item.args}` : item.path;
  }

  /** ファイルパスから親ディレクトリのパスを取得 */
  static getParentPath(filePath: string): string {
    const lastSlash = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
    return lastSlash > 0 ? filePath.substring(0, lastSlash) : '';
  }

  /** パスがショートカットファイル（.lnk）かどうかを判定 */
  static isShortcutFile(filePath?: string): boolean {
    return filePath?.toLowerCase().endsWith('.lnk') ?? false;
  }

  /** ファイルパスからファイル名を取得 */
  static getFileName(filePath: string): string {
    const lastSlash = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
    return lastSlash !== -1 ? filePath.substring(lastSlash + 1) : filePath;
  }

  /** ファイルパスから拡張子を取得（ドット含む、小文字） */
  static getExtension(filePath: string): string {
    const fileName = this.getFileName(filePath);
    const lastDot = fileName.lastIndexOf('.');
    return lastDot !== -1 ? fileName.substring(lastDot).toLowerCase() : '';
  }
}
