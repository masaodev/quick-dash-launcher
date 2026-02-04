import type { LauncherItem } from '@common/types';

import {
  extractCustomUriIcon,
  extractFileIconByExtension,
  extractIcon,
} from '../ipc/iconHandlers.js';

/**
 * アイテムタイプに応じて適切なアイコンを取得
 */
export async function getIconForItem(
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
      // folder, url, clipboard はデフォルトアイコンを使用
      return undefined;
  }
}
