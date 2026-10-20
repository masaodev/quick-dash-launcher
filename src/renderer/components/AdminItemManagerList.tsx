import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { JsonItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';

import { useAdminCellEditing } from '../hooks/useAdminCellEditing';
import { useAdminContextMenu } from '../hooks/useAdminContextMenu';
import { getAdminItemIcon, useAdminItemIcons } from '../hooks/useAdminItemIcons';
import { useAdminItemColumns } from '../hooks/useAdminItemColumns';
import { FIXED_COLUMN_COUNT } from '../utils/adminItemColumns';
import { getItemKey, type SortColumn, type SortState } from '../utils/editableItemOperations';

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
  const columns = useAdminItemColumns();
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
  const rowVirtualizer = useVirtualizer({
    count: editableItems.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 28, // 行高26px + 境界線。折り返し行はmeasureElementで実測補正
    overscan: 10,
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

  const allSelected =
    editableItems.length > 0 && editableItems.every((item) => selectedItems.has(getItemKey(item)));
  const someSelected = editableItems.some((item) => selectedItems.has(getItemKey(item)));

  return (
    <div className="editable-raw-item-list" ref={listRef}>
      <table className="raw-items-table">
        <AdminItemManagerTableHead
          sortState={sortState}
          onSortChange={onSortChange}
          allSelected={allSelected}
          someSelected={someSelected}
          onSelectAll={onSelectAll}
          columns={columns.visibleColumns}
          onResizeStart={columns.startResize}
          onHeaderContextMenu={handleHeaderContextMenu}
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
