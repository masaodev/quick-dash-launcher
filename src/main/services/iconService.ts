import type { LauncherItem } from '@common/types';

import { getIconForItem as getIconForItemByType } from '../ipc/iconHandlers.js';

/**
 * アイテムタイプに応じて適切なアイコンを取得
 *
 * 実装は iconHandlers の統合APIに一本化されている（かつて同一ロジックの
 * 別実装が存在し、仕様の分岐点が2つに分散していたため委譲に変更）。
 */
export async function getIconForItem(
  filePath: string,
  itemType: LauncherItem['type']
): Promise<string | undefined> {
  return (await getIconForItemByType(filePath, itemType)) ?? undefined;
}
