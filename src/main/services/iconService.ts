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
    switch (itemType) {
      case 'app':
        return (await extractIcon(filePath, iconsFolder)) ?? undefined;
      case 'file':
        return (await extractFileIconByExtension(filePath, extensionsFolder)) ?? undefined;
      case 'customUri':
        return (await extractCustomUriIcon(filePath, iconsFolder)) ?? undefined;
      default:
        // folder と url タイプはアイコン取得をスキップ（デフォルトアイコンを使用）
        return undefined;
    }
  }
}
