import type { LauncherItem } from '@common/types';

import {
  extractIcon,
  extractFileIconByExtension,
  extractCustomUriIcon,
} from '../ipc/iconHandlers.js';

/**
 * アイコン取得サービス
 *
 * アイテムタイプに応じた適切なアイコン取得処理を提供します。
 * 重複したアイコン取得ロジックを一箇所に集約し、保守性を向上させます。
 */
export class IconService {
  /**
   * アイテムタイプに応じて適切なアイコンを取得
   *
   * @param filePath ファイルパスまたはURL
   * @param itemType アイテムタイプ
   * @param iconsFolder アイコンキャッシュフォルダのパス
   * @param extensionsFolder 拡張子アイコンフォルダのパス
   * @returns アイコンのbase64データURL（取得失敗時はundefined）
   *
   * @example
   * ```typescript
   * const icon = await IconService.getIconForItem(
   *   'C:\\Program Files\\app.exe',
   *   'app',
   *   iconsFolder,
   *   extensionsFolder
   * );
   * ```
   */
  static async getIconForItem(
    filePath: string,
    itemType: LauncherItem['type'],
    iconsFolder: string,
    extensionsFolder: string
  ): Promise<string | undefined> {
    if (itemType === 'app') {
      // EXE/アプリケーションのアイコンを抽出
      const icon = await extractIcon(filePath, iconsFolder);
      return icon || undefined;
    } else if (itemType === 'file') {
      // 拡張子ベースのアイコンを取得
      const icon = await extractFileIconByExtension(filePath, extensionsFolder);
      return icon || undefined;
    } else if (itemType === 'customUri') {
      // カスタムURIのアイコンを取得
      const icon = await extractCustomUriIcon(filePath, iconsFolder);
      return icon || undefined;
    }

    // folder と url タイプはアイコン取得をスキップ（デフォルトアイコンを使用）
    return undefined;
  }
}
