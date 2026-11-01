import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { EditableJsonItem, PathExistenceStatus } from '@common/types/editableItem';
import type { LaunchUsageRecord } from '@common/types/launchUsage';
import { isJsonWsGroupItem } from '@common/types';
import { findMissingWsGroupIds } from '@common/utils/wsGroupExpansion';

import {
  activeFilterColumns,
  matchesColumnFilters,
  type ColumnFilters,
  type FilterableColumnId,
} from '../utils/adminItemFilters';
import {
  applyDisplayOrder,
  filterEditableItems,
  getItemKey,
  sortItemIds,
  toggleSort,
  type SortColumn,
  type SortState,
} from '../utils/editableItemOperations';

import {
  useAdminPathExistence,
  evaluateItemPathCheck,
  type ItemPathCheck,
  type PathCheckSummary,
} from './useAdminPathExistence';
import { useWsGroupCandidates } from './useWsGroupCandidates';

interface UseAdminItemListViewOptions {
  /** 未保存の編集を含む全データファイルのアイテム */
  workingItems: EditableJsonItem[];
  /** 読み込み・保存のたびに変わる版（表示順の作り直しとリンク切れの結果の破棄に使う） */
  baseVersion: number;
  selectedDataFile: string;
  searchQuery: string;
  selectedItems: Set<string>;
  /** 見えている行だけを選択に残す */
  retainVisibleSelection: (visibleItems: EditableJsonItem[]) => void;
  /** 起動の記録（最終起動・起動回数の並べ替えと絞り込み） */
  usageOf: (item: EditableJsonItem) => LaunchUsageRecord | undefined;
  /** 起動の記録を読み込めたか（読めたら、記録で並べている順を作り直す） */
  usageLoaded: boolean;
  /** 自動取込ルールの id → 名前（取込元で並べるとき） */
  ruleNames: Map<string, string>;
}

/**
 * アイテム管理の一覧に「どの行を・どの順で出すか」を決める
 *
 * 見出しの ▾ の絞り込み（列ごと）・検索、並べ替え、リンク切れの確認結果を持ち、
 * 表示する行・選択中の見えている行を返す
 */
export function useAdminItemListView({
  workingItems,
  baseVersion,
  selectedDataFile,
  searchQuery,
  selectedItems,
  retainVisibleSelection,
  usageOf,
  usageLoaded,
  ruleNames,
}: UseAdminItemListViewOptions) {
  // 並べ替え。初期値はランチャーと同じ表示名の昇順
  const [sortState, setSortState] = useState<SortState>({
    column: 'displayName',
    direction: 'asc',
  });

  const [filters, setFilters] = useState<ColumnFilters>({});

  // リンク切れ（パスが実在しない）。ネットワークパスは応答に時間がかかることがあるので、
  // 自動では確認せず、「整理 ▼」の「リンク切れを確認」を押したときだけ確認する
  const pathCheck = useAdminPathExistence(baseVersion);
  // セットの行が指すアイテムがまだあるか（どのデータファイルのアイテムでもよい）
  const workingItemIds = useMemo(
    () => new Set(workingItems.map((item) => item.item.id)),
    [workingItems]
  );
  // 確認したアイテム（表示中のデータファイル）ごとの結果。行の描画・絞り込み・件数で何度も引くので、1 度だけ作る
  const pathChecks = useMemo(() => {
    const map = new Map<string, ItemPathCheck>();
    if (!pathCheck.hasChecked) return map;
    for (const item of workingItems) {
      if (!pathCheck.checkedIds.has(item.item.id)) continue;
      map.set(getItemKey(item), evaluateItemPathCheck(item, pathCheck.results, workingItemIds));
    }
    return map;
  }, [workingItems, workingItemIds, pathCheck.hasChecked, pathCheck.checkedIds, pathCheck.results]);

  // WSグループの行が指すグループ（A3-224）。グループはすぐ確かめられるので、
  // 「リンク切れを確認」を押さなくても、見つからないグループのある行に印を出す
  const hasWsGroupRows = useMemo(
    () => workingItems.some((item) => isJsonWsGroupItem(item.item)),
    [workingItems]
  );
  const wsGroupCandidates = useWsGroupCandidates(hasWsGroupRows);
  /** WSグループの行（全データファイル）→ 見つからないグループの数（0 件の行は入れない） */
  const missingWsGroupCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!wsGroupCandidates) return map;
    for (const item of workingItems) {
      if (!isJsonWsGroupItem(item.item)) continue;
      const count = findMissingWsGroupIds(item.item, wsGroupCandidates).length;
      if (count > 0) map.set(getItemKey(item), count);
    }
    return map;
  }, [workingItems, wsGroupCandidates]);
  /** WSグループの行の見つからないグループの数（WSグループ以外・見つかる行は 0） */
  const missingWsGroupCountOf = useCallback(
    (item: EditableJsonItem): number => missingWsGroupCounts.get(getItemKey(item)) ?? 0,
    [missingWsGroupCounts]
  );

  const linkStatusOf = useCallback(
    (item: EditableJsonItem): PathExistenceStatus | undefined => {
      const key = getItemKey(item);
      if (missingWsGroupCounts.has(key)) return 'missing';
      // 見つかる WSグループの行は、ほかの行と同じく確認したあとだけ ✓ を出す
      if (isJsonWsGroupItem(item.item)) {
        return wsGroupCandidates && pathCheck.checkedIds.has(item.item.id) ? 'exists' : undefined;
      }
      return pathChecks.get(key)?.status;
    },
    [pathChecks, missingWsGroupCounts, wsGroupCandidates, pathCheck.checkedIds]
  );
  /** セットの行のうち見つからない行の名前（A3-79 #8。セット以外・確認していなければ空） */
  const missingSetRowsOf = useCallback(
    (item: EditableJsonItem): string[] => pathChecks.get(getItemKey(item))?.missingSetRows ?? [],
    [pathChecks]
  );
  /** 表示中のデータファイルの、見つからない行（下の帯の「リンク切れ: N 件」と行の印） */
  const missingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [key, check] of pathChecks) {
      if (check.status === 'missing') ids.add(key);
    }
    for (const item of workingItems) {
      if (item.meta.sourceFile !== selectedDataFile) continue;
      const key = getItemKey(item);
      if (missingWsGroupCounts.has(key)) ids.add(key);
    }
    return ids;
  }, [pathChecks, workingItems, selectedDataFile, missingWsGroupCounts]);
  /** 「リンク切れを確認」を実行する（表示中のデータファイルのアイテムを確かめる。WSグループの行も数える） */
  const runPathCheck = useCallback(
    async (items: EditableJsonItem[]): Promise<PathCheckSummary> => {
      const summary = await pathCheck.runCheck(items, workingItemIds);
      if (!wsGroupCandidates) return summary;
      for (const item of items) {
        if (!isJsonWsGroupItem(item.item)) continue;
        summary.checked++;
        if (findMissingWsGroupIds(item.item, wsGroupCandidates).length > 0) summary.missing++;
      }
      return summary;
    },
    [pathCheck, workingItemIds, wsGroupCandidates]
  );

  // 読み込み・保存で確認の結果が捨てられたら、リンクの絞り込みも解く
  useEffect(() => {
    if (!pathCheck.hasChecked) setFilters(({ link: _link, ...rest }) => rest);
  }, [pathCheck.hasChecked]);

  // 取込元のルールはデータファイルごとなので、ファイルを変えたら取込元の絞り込みを解く
  useEffect(() => {
    setFilters(({ source: _source, ...rest }) => rest);
  }, [selectedDataFile]);

  const filteredItems = useMemo(() => {
    const searched = filterEditableItems(workingItems, {
      sourceFile: selectedDataFile,
      searchQuery,
    });
    if (activeFilterColumns(filters).length === 0) return searched;
    const context = {
      linkStatusOf,
      lastLaunchedAtOf: (item: EditableJsonItem) => usageOf(item)?.lastLaunchedAt,
      now: Date.now(),
    };
    return searched.filter((item) => matchesColumnFilters(item, filters, context));
  }, [workingItems, selectedDataFile, searchQuery, filters, linkStatusOf, usageOf]);

  // 表示順は「読み込み・保存時」と「見出しクリック時」にだけ作り直し、編集中は固定する。
  // こうしないと、名前を入力した瞬間に行が並び順の位置へ飛んでしまう
  const workingItemsRef = useRef(workingItems);
  workingItemsRef.current = workingItems;
  const usageOfRef = useRef(usageOf);
  usageOfRef.current = usageOf;
  const ruleNamesRef = useRef(ruleNames);
  ruleNamesRef.current = ruleNames;
  const displayOrder = useMemo(
    () =>
      sortItemIds(workingItemsRef.current, sortState, usageOfRef.current, (ruleId) =>
        ruleNamesRef.current.get(ruleId)
      ),
    // baseVersion・usageLoaded は作り直しの契機として使う（値そのものは使わない）。
    // 記録は focus のたびに読み直すが、そのたびに行が動かないよう、最初に読めたときだけ作り直す
    [sortState, baseVersion, usageLoaded]
  );
  const orderedItems = useMemo(
    () => applyDisplayOrder(filteredItems, displayOrder),
    [filteredItems, displayOrder]
  );

  const handleSortChange = (column: SortColumn) => setSortState((prev) => toggleSort(prev, column));
  /** 見出しの ▾ から向きを決めて並べる */
  const setSort = useCallback(
    (column: SortColumn, direction: SortState['direction']) => setSortState({ column, direction }),
    []
  );

  const visibleSelectedItems = useMemo(
    () => filteredItems.filter((item) => selectedItems.has(getItemKey(item))),
    [filteredItems, selectedItems]
  );

  // 表示されなくなったアイテム（検索・絞り込み・ファイル切替）の選択を外す
  useEffect(() => {
    retainVisibleSelection(filteredItems);
  }, [filteredItems, retainVisibleSelection]);

  /** 1 つの列の絞り込みを変える（undefined で外す） */
  const setColumnFilter = useCallback(
    <K extends FilterableColumnId>(column: K, value: ColumnFilters[K] | undefined) =>
      setFilters((prev) => {
        const next = { ...prev };
        if (value === undefined) delete next[column];
        else next[column] = value;
        return next;
      }),
    []
  );

  /** 見出しの ▾ の絞り込みをすべて外す。検索欄は呼び出し側が持つ */
  const clearFilters = useCallback(() => setFilters({}), []);

  const isFiltered = searchQuery.trim().length > 0 || activeFilterColumns(filters).length > 0;

  return {
    sortState,
    handleSortChange,
    setSort,
    filters,
    setColumnFilter,
    pathCheck,
    linkStatusOf,
    missingSetRowsOf,
    missingWsGroupCountOf,
    missingIds,
    runPathCheck,
    filteredItems,
    orderedItems,
    visibleSelectedItems,
    isFiltered,
    clearFilters,
  };
}
