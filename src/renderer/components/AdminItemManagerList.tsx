import React, { useCallback, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { JsonItem } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';

import { useAdminCellEditing } from '../hooks/useAdminCellEditing';
import { useAdminContextMenu } from '../hooks/useAdminContextMenu';
import { useAdminItemIcons } from '../hooks/useAdminItemIcons';
import { useColumnResize } from '../hooks/useColumnResize';
import { getItemKey, type SortColumn, type SortState } from '../utils/editableItemOperations';

import AdminItemManagerRow from './AdminItemManagerRow';
import AdminItemManagerTableHead from './AdminItemManagerTableHead';

/** 一覧のテーブルの列数（スペーサー行の colSpan に使う） */
const COLUMN_COUNT = 7;

interface AdminItemManagerListProps {
  /** 表示順に並べ済みのアイテム（並べ替えは呼び出し側が行う） */
  editableItems: EditableJsonItem[];
  selectedItems: Set<string>;
  /** 未保存の変更があるアイテムの id（行に印を付ける） */
  changedIds: Set<string>;
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
  const editing = useAdminCellEditing(onItemEdit);
  const itemIcons = useAdminItemIcons(editableItems);
  const nameColumn = useColumnResize(100);
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

  // 追加直後のアイテム: 見える位置へスクロールして名前セルを編集状態にする
  useEffect(() => {
    if (!autoEditItemId) return;
    const index = editableItems.findIndex((item) => item.item.id === autoEditItemId);
    if (index === -1) return;
    rowVirtualizer.scrollToIndex(index);
    editing.beginNameEditFor(autoEditItemId);
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
          nameColumnWidth={nameColumn.width}
          nameHeaderRef={nameColumn.headerRef}
          onNameResizeMouseDown={nameColumn.handleMouseDown}
        />
        <tbody>
          {paddingTop > 0 && (
            <tr aria-hidden="true">
              <td
                colSpan={COLUMN_COUNT}
                style={{ height: paddingTop, padding: 0, border: 'none' }}
              />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const item = editableItems[virtualRow.index];
            const itemKey = getItemKey(item);
            const isEditingRow = editing.editingCell?.itemId === itemKey;
            const jsonItem = item.item;

            return (
              <AdminItemManagerRow
                key={itemKey}
                item={item}
                index={virtualRow.index}
                isSelected={selectedItems.has(itemKey)}
                isChanged={changedIds.has(itemKey)}
                iconData={jsonItem.type === 'item' ? itemIcons.get(jsonItem.path || '') : undefined}
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
              />
            );
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden="true">
              <td
                colSpan={COLUMN_COUNT}
                style={{ height: paddingBottom, padding: 0, border: 'none' }}
              />
            </tr>
          )}
        </tbody>
      </table>

      {editableItems.length === 0 && (
        <div className="no-items">
          {isFiltered
            ? '条件に一致するアイテムがありません'
            : 'このデータファイルにアイテムがありません。「➕ アイテムを追加」か「アイテムを一括取り込み」で追加できます'}
        </div>
      )}
    </div>
  );
};

export default AdminItemManagerList;
