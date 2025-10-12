import { LauncherItem } from '../../common/types';

/**
 * LauncherItem配列をそのまま返す（後方互換性のため）
 * メインプロセスで既に完全にパース済みのため、この関数は不要だがApp.tsxとの互換性のために残す
 *
 * @deprecated メインプロセスで完全にパース済みのため、この関数は不要です
 * @param items - LauncherItem配列
 * @returns そのまま返す
 */
export function parseDataFiles(items: LauncherItem[]): {
  mainItems: LauncherItem[];
} {
  return { mainItems: items };
}

export function filterItems(items: LauncherItem[], query: string): LauncherItem[] {
  if (!query) {
    return items;
  }

  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((k) => k.length > 0);

  return items.filter((item) => {
    const itemText = item.name.toLowerCase();
    return keywords.every((keyword) => itemText.includes(keyword));
  });
}
