import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { EditableJsonItem } from '@common/types/editableItem';

import {
  applyDisplayOrder,
  filterEditableItems,
  getItemKey,
  sortItemIds,
  toggleSort,
  type AutoImportFilter,
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
}

/**
 * アイテム管理の一覧に「どの行を・どの順で出すか」を決める
 *
 * 絞り込み（取込元・リンク切れのみ・検索）、並べ替え、リンク切れの確認結果を持ち、
 * 表示する行・選択中の見えている行を返す
 */
export function useAdminItemListView({
  workingItems,
  baseVersion,
  selectedDataFile,
  searchQuery,
  selectedItems,
  retainVisibleSelection,
}: UseAdminItemListViewOptions) {
  // 並べ替え。初期値はメイン画面と同じ表示名の昇順
  const [sortState, setSortState] = useState<SortState>({
    column: 'displayName',
    direction: 'asc',
  });

  const [autoImportFilter, setAutoImportFilter] = useState<AutoImportFilter>('all');

  // リンク切れ（パスが実在しない）。ネットワークパスは応答に時間がかかることがあるので、
  // 自動では確認せず、「整理 ▼」の「リンク切れを確認」を押したときだけ確認する
  const [missingOnly, setMissingOnly] = useState(false);
  const pathCheck = useAdminPathExistence(baseVersion);
  const missingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of workingItems) {
      const itemPath = checkablePathOf(item);
      if (itemPath && pathCheck.results.get(itemPath) === 'missing') ids.add(getItemKey(item));
    }
    return ids;
  }, [workingItems, pathCheck.results]);

  // 読み込み・保存で結果が捨てられたら絞り込みも解く
  useEffect(() => {
    if (!pathCheck.hasChecked) setMissingOnly(false);
  }, [pathCheck.hasChecked]);

  // ファイル変更時にフィルタをリセット
  useEffect(() => {
    setAutoImportFilter('all');
  }, [selectedDataFile]);

  const filteredItems = useMemo(() => {
    const filtered = filterEditableItems(workingItems, {
      sourceFile: selectedDataFile,
      autoImportFilter,
      searchQuery,
    });
    return missingOnly ? filtered.filter((item) => missingIds.has(getItemKey(item))) : filtered;
  }, [workingItems, selectedDataFile, autoImportFilter, searchQuery, missingOnly, missingIds]);

  // 表示順は「読み込み・保存時」と「見出しクリック時」にだけ作り直し、編集中は固定する。
  // こうしないと、名前を入力した瞬間に行が並び順の位置へ飛んでしまう
  const workingItemsRef = useRef(workingItems);
  workingItemsRef.current = workingItems;
  const displayOrder = useMemo(
    () => sortItemIds(workingItemsRef.current, sortState),
    // baseVersion は作り直しの契機として使う（値そのものは使わない）
    [sortState, baseVersion]
  );
  const orderedItems = useMemo(
    () => applyDisplayOrder(filteredItems, displayOrder),
    [filteredItems, displayOrder]
  );

  const handleSortChange = (column: SortColumn) => setSortState((prev) => toggleSort(prev, column));

  const visibleSelectedItems = useMemo(
    () => filteredItems.filter((item) => selectedItems.has(getItemKey(item))),
    [filteredItems, selectedItems]
  );

  // 表示されなくなったアイテム（検索・フィルタ・ファイル切替）の選択を外す
  useEffect(() => {
    retainVisibleSelection(filteredItems);
  }, [filteredItems, retainVisibleSelection]);

  /** 検索以外の絞り込み（取込元・リンク切れのみ）を外す。検索欄は呼び出し側が持つ */
  const clearFilters = useCallback(() => {
    setAutoImportFilter('all');
    setMissingOnly(false);
  }, []);

  const toggleMissingOnly = useCallback(() => setMissingOnly((prev) => !prev), []);

  const isFiltered = searchQuery.trim().length > 0 || autoImportFilter !== 'all' || missingOnly;

  return {
    sortState,
    handleSortChange,
    autoImportFilter,
    setAutoImportFilter,
    missingOnly,
    toggleMissingOnly,
    pathCheck,
    missingIds,
    filteredItems,
    orderedItems,
    visibleSelectedItems,
    isFiltered,
    clearFilters,
  };
}
