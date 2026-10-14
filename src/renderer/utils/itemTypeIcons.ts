import type { WorkspaceItem } from '@common/types';

/**
 * アイテムに応じたデフォルトアイコン（絵文字）を返す
 * アイコン画像が取得できていないときのプレースホルダー
 */
export function getDefaultIconForItem(item: WorkspaceItem): string {
  switch (item.type) {
    case 'item':
      switch (item.launcherType) {
        case 'url':
          return '\u{1F310}';
        case 'folder':
          return '\u{1F4C1}';
        case 'app':
          return '\u2699\uFE0F';
        case 'customUri':
          return '\u{1F517}';
        default:
          return '\u{1F4C4}';
      }
    case 'window':
      return '\u{1FA9F}';
    case 'clipboard':
      return '\u{1F4CB}';
    case 'set':
      return '\u{1F4E6}';
  }
}
