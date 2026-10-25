import type { JsonItem, JsonSetItem } from '../types';

/**
 * 指定のアイテムを行で指しているセットの名前（A3-79 #6。アイテムを消す前に知らせるため）
 *
 * 消すアイテムの中にあるセットは数えない（一緒に消えるので）。同じ名前のセットが複数あれば、その数だけ並べる
 */
export function findSetNamesUsingItems(
  items: readonly JsonItem[],
  itemIds: readonly string[]
): string[] {
  const targets = new Set(itemIds);
  return items
    .filter(
      (item): item is JsonSetItem =>
        item.type === 'set' &&
        !targets.has(item.id) &&
        item.entries.some((entry) => !!entry.itemId && targets.has(entry.itemId))
    )
    .map((item) => item.displayName);
}
