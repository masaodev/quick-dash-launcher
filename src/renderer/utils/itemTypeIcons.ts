import type { WorkspaceItem, ExecutionHistoryItem } from '@common/types';

type ItemType = WorkspaceItem['type'] | ExecutionHistoryItem['itemType'];

/**
 * アイテムタイプに応じたデフォルトアイコンを返す
 */
export function getDefaultIconForItemType(type: ItemType): string {
  switch (type) {
    case 'url':
      return '\u{1F310}';
    case 'folder':
      return '\u{1F4C1}';
    case 'app':
      return '\u2699\uFE0F';
    case 'file':
      return '\u{1F4C4}';
    case 'customUri':
      return '\u{1F517}';
    case 'group':
      return '\u{1F4E6}';
    case 'windowOperation':
      return '\u{1FA9F}';
    case 'clipboard':
      return '\u{1F4CB}';
    default:
      return '\u{1F4C4}';
  }
}
