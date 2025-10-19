import type { LauncherItem } from '@common/types';

/**
 * パス操作の共通ユーティリティクラス
 * プロジェクト全体で重複しているパス操作を統一する
 */
export class PathUtils {
  /**
   * アイテムのフルパス（引数を含む）を取得
   * @param item ランチャーアイテム
   * @returns パス + 引数（存在する場合）
   */
  static getFullPath(item: LauncherItem): string {
    return item.args ? `${item.path} ${item.args}` : item.path;
  }

  /**
   * ファイルパスから親ディレクトリのパスを取得
   * @param filePath ファイルパス
   * @returns 親ディレクトリのパス、見つからない場合は空文字列
   */
  static getParentPath(filePath: string): string {
    const lastSlash = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
    return lastSlash > 0 ? filePath.substring(0, lastSlash) : '';
  }

  /**
   * パスがショートカットファイル（.lnk）かどうかを判定
   * @param filePath ファイルパス（undefinedまたはnull可）
   * @returns ショートカットファイルの場合はtrue
   */
  static isShortcutFile(filePath?: string): boolean {
    return filePath?.toLowerCase().endsWith('.lnk') ?? false;
  }

  /**
   * アイテムがショートカットファイルかどうかを判定（originalPathをチェック）
   * @param item ランチャーアイテム
   * @returns ショートカットファイルの場合はtrue
   */
  static isShortcutItem(item: LauncherItem): boolean {
    return this.isShortcutFile(item.originalPath);
  }
}
