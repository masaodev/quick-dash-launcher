import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { JsonItem } from '@common/types';
import type { EditableJsonItem, PathExistenceStatus } from '@common/types/editableItem';
import type { LaunchUsageRecord } from '@common/types/launchUsage';

import { useAdminCellEditing } from '../hooks/useAdminCellEditing';
import { useAdminContextMenu } from '../hooks/useAdminContextMenu';
import { getAdminItemIcon, useAdminItemIcons } from '../hooks/useAdminItemIcons';
import type { AdminItemColumns } from '../hooks/useAdminItemColumns';
import {
  ACTIONS_COLUMN_WIDTH,
  ADMIN_ITEM_COLUMNS,
  CHECKBOX_COLUMN_WIDTH,
  FIXED_COLUMN_COUNT,
  filterColumnOf,
  tableMinWidthOf,
  type AdminItemColumnId,
} from '../utils/adminItemColumns';
import { measureColumnFitWidth } from '../utils/adminItemColumnFit';
import {
  activeFilterColumns,
  type ColumnFilters,
  type FilterableColumnId,
} from '../utils/adminItemFilters';
import { getItemKey, type SortColumn, type SortState } from '../utils/editableItemOperations';

import AdminItemManagerColumnFilter, {
  type ColumnFilterOptions,
} from './AdminItemManagerColumnFilter';
import AdminItemManagerColumnMenu from './AdminItemManagerColumnMenu';
import AdminItemManagerRow from './AdminItemManagerRow';
import AdminItemManagerTableHead from './AdminItemManagerTableHead';
import VirtualSpacerRow from './VirtualSpacerRow';

interface AdminItemManagerListProps {
  /** 表示順に並べ済みのアイテム（並べ替えは呼び出し側が行う） */
  editableItems: EditableJsonItem[];
  selectedItems: Set<string>;
  /** 未保存の変更があるアイテムの id（行に印を付ける） */
  changedIds: Set<string>;
  /** パスが実在しないアイテムの id（リンク切れの印） */
  missingIds: Set<string>;
  /** 検索・フィルタで絞り込み中か（0 件のときの文言に使う） */
  isFiltered: boolean;
  sortState: SortState;
  onSortChange: (column: SortColumn) => void;
  /** 見出しの ▾ から向きを決めて並べる */
  onSort: (column: SortColumn, direction: SortState['direction']) => void;
  /** 列の表示と幅（見出しの右クリック・ドラッグ） */
  columns: AdminItemColumns;
  /** 見出しの ▾ の絞り込み */
  filters: ColumnFilters;
  onFilterChange: <K extends FilterableColumnId>(
    column: K,
    value: ColumnFilters[K] | undefined
  ) => void;
  filterOptions: ColumnFilterOptions;
  /** 「リンク切れを確認」の結果（確認していない・対象外のパスは undefined） */
  linkStatusOf: (item: EditableJsonItem) => PathExistenceStatus | undefined;
  /** 起動の記録（記録が無ければ undefined） */
  usageOf: (item: EditableJsonItem) => LaunchUsageRecord | undefined;
  /** 追加直後に名前セルを編集状態にするアイテムの id */
  autoEditItemId: string | null;
  onAutoEditHandled: () => void;
  onItemEdit: (item: EditableJsonItem) => void;
  onChangeType: (item: EditableJsonItem, newType: JsonItem['type']) => void;
  onItemSelect: (item: EditableJsonItem, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  /** 削除の確認は呼び出し側（AdminItemManagerView）で行う */
  onRequestDelete: (items: EditableJsonItem[]) => void;
  onEditClick: (item: EditableJsonItem) => void;
  onDuplicateItems: (items: EditableJsonItem[]) => void;
  autoImportRuleMap?: Map<string, string>;
}

/**
 * アイテム管理の一覧（仮想化したテーブル）
 *
 * 行の描画は AdminItemManagerRow、見出しは AdminItemManagerTableHead。
 * セル編集・アイコン取得・右クリックメニュー・列幅変更はそれぞれのフックに分けている。
 */
const AdminItemManagerList: React.FC<AdminItemManagerListProps> = ({
  editableItems,
  selectedItems,
  changedIds,
  missingIds,
  isFiltered,
  sortState,
  onSortChange,
  onSort,
  columns,
  filters,
  onFilterChange,
  filterOptions,
  linkStatusOf,
  usageOf,
  autoEditItemId,
  onAutoEditHandled,
  onItemEdit,
  onChangeType,
  onItemSelect,
  onSelectAll,
  onRequestDelete,
  onEditClick,
  onDuplicateItems,
  autoImportRuleMap,
}) => {
  const { t } = useTranslation();
  const editing = useAdminCellEditing(onItemEdit);
  const itemIcons = useAdminItemIcons(editableItems);
  const columnIdsKey = columns.visibleColumns.map((c) => c.def.id).join(',');
  // 行の memo を効かせるため、出す列が変わったときだけ配列を作り直す
  const columnIds = useMemo(() => columns.visibleColumns.map((c) => c.def.id), [columnIdsKey]);
  const columnCount = FIXED_COLUMN_COUNT + columnIds.length;
  const [columnMenuAt, setColumnMenuAt] = useState<{ x: number; y: number } | null>(null);
  const closeColumnMenu = useCallback(() => setColumnMenuAt(null), []);
  const handleHeaderContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setColumnMenuAt({ x: e.clientX, y: e.clientY });
  }, []);
  const [openFilter, setOpenFilter] = useState<{
    column: FilterableColumnId;
    x: number;
    y: number;
  } | null>(null);
  const closeFilter = useCallback(() => setOpenFilter(null), []);
  const handleOpenFilter = useCallback((id: AdminItemColumnId, rect: DOMRect) => {
    const def = ADMIN_ITEM_COLUMNS.find((c) => c.id === id);
    const column = def ? filterColumnOf(def) : null;
    if (!column) return;
    // 画面からはみ出す分は、メニューの側で測って内側へずらす（usePopoverPosition）
    setOpenFilter((prev) =>
      prev?.column === column ? null : { column, x: rect.left, y: rect.bottom }
    );
  }, []);
  const filteredColumns = useMemo(() => new Set<string>(activeFilterColumns(filters)), [filters]);
  const openFilterDef = openFilter
    ? ADMIN_ITEM_COLUMNS.find((c) => c.id === openFilter.column)
    : undefined;

  const { openContextMenu } = useAdminContextMenu({
    onDuplicateItems,
    onEditClick,
    onRequestDelete,
  });

  // 行に渡すハンドラは参照を固定する（AdminItemManagerRow の memo を効かせるため）
  const itemsRef = useRef(editableItems);
  itemsRef.current = editableItems;
  const selectedRef = useRef(selectedItems);
  selectedRef.current = selectedItems;
  const handleContextMenu = useCallback(
    (event: React.MouseEvent, item: EditableJsonItem) =>
      openContextMenu(event, item, itemsRef.current, selectedRef.current),
    [openContextMenu]
  );

  // 行の仮想化: スクロールコンテナは .editable-raw-item-list。
  // テーブル構造（sticky thead・列幅）を保つため、可視範囲外は上下のスペーサー行で高さを確保する
  const listRef = useRef<HTMLDivElement>(null);
  // 列の境目のダブルクリックで幅を中身に合わせる列（A3-184）。測る間だけ全部の行を描く
  const [fitColumnId, setFitColumnId] = useState<AdminItemColumnId | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: editableItems.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 28, // 行高26px + 境界線。折り返し行はmeasureElementで実測補正
    overscan: fitColumnId ? editableItems.length : 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  // 追加直後のアイテム: 見える位置へスクロールして名前セル（名前の無いフォルダ取込はパスセル）を編集状態にする
  useEffect(() => {
    if (!autoEditItemId) return;
    const index = editableItems.findIndex((item) => item.item.id === autoEditItemId);
    if (index === -1) return;
    rowVirtualizer.scrollToIndex(index);
    const added = editableItems[index];
    if (added.item.type === 'dir') {
      editing.startPathEdit(added);
    } else {
      editing.beginNameEditFor(autoEditItemId);
    }
    onAutoEditHandled();
  }, [autoEditItemId, editableItems]);

  // 全部の行を描いたところで測り、幅を保存して、見えている行だけを描く状態に戻す。
  // 測るのは今の一覧（今のタブ・絞り込み・検索の後）の行
  const tableRef = useRef<HTMLTableElement>(null);
  useLayoutEffect(() => {
    if (!fitColumnId) return;
    const def = ADMIN_ITEM_COLUMNS.find((c) => c.id === fitColumnId);
    const width = def && tableRef.current ? measureColumnFitWidth(tableRef.current, def) : null;
    setFitColumnId(null);
    if (width !== null) columns.setColumnWidth(fitColumnId, width);
  }, [fitColumnId]);

  const allSelected =
    editableItems.length > 0 && editableItems.every((item) => selectedItems.has(getItemKey(item)));
  const someSelected = editableItems.some((item) => selectedItems.has(getItemKey(item)));

  return (
    <div className="editable-raw-item-list" ref={listRef}>
      <table
        ref={tableRef}
        className="raw-items-table"
        style={
          {
            minWidth: tableMinWidthOf(columns.visibleColumns.map((c) => c.width)),
            '--checkbox-column-width': `${CHECKBOX_COLUMN_WIDTH}px`,
            '--actions-column-width': `${ACTIONS_COLUMN_WIDTH}px`,
          } as React.CSSProperties
        }
      >
        <AdminItemManagerTableHead
          sortState={sortState}
          onSortChange={onSortChange}
          allSelected={allSelected}
          someSelected={someSelected}
          onSelectAll={onSelectAll}
          columns={columns.visibleColumns}
          onResizeStart={columns.startResize}
          onAutoFit={setFitColumnId}
          onHeaderContextMenu={handleHeaderContextMenu}
          filteredColumns={filteredColumns}
          onOpenFilter={handleOpenFilter}
        />
        <tbody>
          <VirtualSpacerRow height={paddingTop} colSpan={columnCount} />
          {virtualRows.map((virtualRow) => {
            const item = editableItems[virtualRow.index];
            const itemKey = getItemKey(item);
            const isEditingRow = editing.editingCell?.itemId === itemKey;
            const jsonItem = item.item;

            return (
              <AdminItemManagerRow
                key={itemKey}
                item={item}
                columns={columnIds}
                index={virtualRow.index}
                isSelected={selectedItems.has(itemKey)}
                isChanged={changedIds.has(itemKey)}
                pathMissing={missingIds.has(itemKey)}
                linkStatus={linkStatusOf(item)}
                lastLaunchedAt={usageOf(item)?.lastLaunchedAt}
                launchCount={usageOf(item)?.count}
                iconData={getAdminItemIcon(itemIcons, jsonItem)}
                autoImportRuleName={
                  jsonItem.type === 'item' && jsonItem.autoImportRuleId
                    ? autoImportRuleMap?.get(jsonItem.autoImportRuleId)
                    : undefined
                }
                editingColumn={isEditingRow ? editing.editingCell!.column : null}
                editingValue={isEditingRow ? editing.editingValue : ''}
                measureRef={rowVirtualizer.measureElement}
                onSelect={onItemSelect}
                onEditClick={onEditClick}
                onRequestDelete={onRequestDelete}
                onChangeType={onChangeType}
                onContextMenu={handleContextMenu}
                onStartNameEdit={editing.startNameEdit}
                onStartPathEdit={editing.startPathEdit}
                onEditingValueChange={editing.setEditingValue}
                onCommitName={editing.commitNameEdit}
                onCommitPath={editing.commitPathEdit}
                onNameKeyDown={editing.handleNameKeyDown}
                onPathKeyDown={editing.handlePathKeyDown}
                onStartMemoEdit={editing.startMemoEdit}
                onCommitMemo={editing.commitMemoEdit}
                onMemoKeyDown={editing.handleMemoKeyDown}
              />
            );
          })}
          <VirtualSpacerRow height={paddingBottom} colSpan={columnCount} />
        </tbody>
      </table>

      {openFilter && (
        <AdminItemManagerColumnFilter
          column={openFilter.column}
          position={{ x: openFilter.x, y: openFilter.y }}
          filters={filters}
          onChange={onFilterChange}
          sortColumn={openFilterDef?.sortColumn}
          sortState={sortState}
          onSort={onSort}
          options={filterOptions}
          onClose={closeFilter}
        />
      )}

      {columnMenuAt && (
        <AdminItemManagerColumnMenu
          position={columnMenuAt}
          setting={columns.setting}
          onToggle={columns.setColumnVisible}
          onReset={columns.resetColumns}
          onClose={closeColumnMenu}
        />
      )}

      {editableItems.length === 0 && (
        <div className="no-items">
          {isFiltered ? t('itemManager.table.emptyFiltered') : t('itemManager.table.empty')}
        </div>
      )}
    </div>
  );
};

export default AdminItemManagerList;
