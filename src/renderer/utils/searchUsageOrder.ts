import type { AppItem } from '@common/types';
import { isWindowInfo } from '@common/types/guards';
import {
  launchUsagePathKey,
  mergeLaunchUsage,
  type LaunchUsageSnapshot,
} from '@common/types/launchUsage';

import { normalizeForSearch, parseKeywords } from './dataParser';

/**
 * ランチャーのアイテムを開いた回数（起動の記録の id の分と、ワークスペースから同じパスを開いた分の合計）
 *
 * フォルダ取込で展開したアイテムは、取込の行の id でまとめて数えていて 1 件ずつの回数が分からないので 0 とする
 */
export function launchCountOf(item: AppItem, usage: LaunchUsageSnapshot): number {
  if (isWindowInfo(item) || ('isDirExpanded' in item && item.isDirExpanded)) return 0;
  const byId = item.id ? usage.byId[item.id] : undefined;
  const path = 'path' in item && typeof item.path === 'string' ? item.path : '';
  const byPath = path ? usage.byPath[launchUsagePathKey(path)] : undefined;
  return mergeLaunchUsage(byId, byPath)?.count ?? 0;
}

/**
 * 検索の結果を「名前が最初の語で始まる → 開いた回数の多い順 → 今の順」に並べ替える（設定 searchSortByUsage）
 *
 * 検索語が空のときは並べ替えない（一覧の順のまま）。同じ順位のものは今の順を保つ
 */
export function sortByUsage(
  items: AppItem[],
  query: string,
  countOf: (item: AppItem) => number
): AppItem[] {
  const [first] = parseKeywords(query);
  if (!first) return items;
  const ranked = items.map((item, index) => {
    const name = isWindowInfo(item) ? item.title : item.displayName;
    return {
      item,
      index,
      prefix: normalizeForSearch(name).startsWith(first) ? 1 : 0,
      count: countOf(item),
    };
  });
  ranked.sort((a, b) => b.prefix - a.prefix || b.count - a.count || a.index - b.index);
  return ranked.map((r) => r.item);
}
