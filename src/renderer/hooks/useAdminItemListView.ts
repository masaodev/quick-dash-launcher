import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { EditableJsonItem } from '@common/types/editableItem';
import type { LaunchUsageRecord } from '@common/types/launchUsage';

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

import { useAdminPathExistence, checkablePathOf } from './useAdminPathExistence';

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
  // 並べ替え。初期値はメイン画面と同じ表示名の昇順
  const [sortState, setSortState] = useState<SortState>({
    column: 'displayName',
    direction: 'asc',
  });

  const [filters, setFilters] = useState<ColumnFilters>({});

  // リンク切れ（パスが実在しない）。ネットワークパスは応答に時間がかかることがあるので、
  // 自動では確認せず、「整理 ▼」の「リンク切れを確認」を押したときだけ確認する
  const pathCheck = useAdminPathExistence(baseVersion);
  const linkStatusOf = useCallback(
    (item: EditableJsonItem) => {
      const itemPath = checkablePathOf(item);
      return itemPath ? pathCheck.results.get(itemPath) : undefined;
    },
    [pathCheck.results]
  );
  const missingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of workingItems) {
      if (linkStatusOf(item) === 'missing') ids.add(getItemKey(item));
    }
    return ids;
  }, [workingItems, linkStatusOf]);

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
    missingIds,
    filteredItems,
    orderedItems,
    visibleSelectedItems,
    isFiltered,
    clearFilters,
  };
}
