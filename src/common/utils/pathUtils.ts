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

  /**
   * カスタムURIスキーム（`obsidian://`, `ms-todo:` 等）かどうかを判定する
   *
   * `://` の有無では `ms-todo:` のようなスラッシュなしURIを判定できないため、
   * RFC 3986のスキーム構文で判定した上で以下を除外する。
   * - ドライブレター（`C:\...`）: スキーム名1文字はWindowsパスとみなす
   * - `shell:`: `shell:AppsFolder\...` 等は専用経路で処理する
   * - `file:`: ローカルファイル参照のためカスタムURIとして扱わない
   */
  static isCustomUriScheme(filePath?: string): boolean {
    if (!filePath) return false;

    const match = filePath.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);
    if (!match) return false;

    const scheme = match[1].toLowerCase();
    // 1文字スキームはドライブレター（C:\ 等）とみなす
    if (scheme.length === 1) return false;

    return scheme !== 'shell' && scheme !== 'file';
  }
}
