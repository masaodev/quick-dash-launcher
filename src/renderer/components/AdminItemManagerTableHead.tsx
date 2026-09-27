import React from 'react';

import type { SortColumn, SortState } from '../utils/editableItemOperations';

interface AdminItemManagerTableHeadProps {
  sortState: SortState;
  onSortChange: (column: SortColumn) => void;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: (selected: boolean) => void;
  /** 名前列の幅（ドラッグで変更。未変更なら null） */
  nameColumnWidth: number | null;
  nameHeaderRef: React.RefObject<HTMLTableCellElement | null>;
  onNameResizeMouseDown: (e: React.MouseEvent) => void;
}

const SORT_HINT =
  '並べ替えは見出しをクリックしたときと読み込み時にだけ適用されます（編集中に行は動きません）';

/** アイテム管理の一覧の見出し行（全選択・並べ替え・名前列の幅変更） */
const AdminItemManagerTableHead: React.FC<AdminItemManagerTableHeadProps> = ({
  sortState,
  onSortChange,
  allSelected,
  someSelected,
  onSelectAll,
  nameColumnWidth,
  nameHeaderRef,
  onNameResizeMouseDown,
}) => {
  const renderSortIndicator = (column: SortColumn): React.ReactNode => {
    const isActive = sortState.column === column;
    const icon = isActive ? (sortState.direction === 'asc' ? '▲' : '▼') : '⇅';
    return <span className={`sort-indicator ${isActive ? 'active' : 'inactive'}`}>{icon}</span>;
  };

  return (
    <thead>
      <tr>
        <th className="checkbox-column">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(input) => {
              if (input) input.indeterminate = someSelected && !allSelected;
            }}
            onChange={(e) => onSelectAll(e.target.checked)}
          />
        </th>
        <th className="actions-column">操作</th>
        <th
          className="type-column sortable-header"
          onClick={() => onSortChange('type')}
          title={SORT_HINT}
        >
          <span className="header-content">
            種類
            {renderSortIndicator('type')}
          </span>
        </th>
        <th className="icon-column"></th>
        <th
          className="name-column sortable-header"
          onClick={() => onSortChange('displayName')}
          ref={nameHeaderRef}
          style={
            nameColumnWidth !== null
              ? { width: nameColumnWidth, minWidth: nameColumnWidth, maxWidth: nameColumnWidth }
              : undefined
          }
          title={SORT_HINT}
        >
          <span className="header-content">
            名前
            {renderSortIndicator('displayName')}
          </span>
          <div
            className="column-resize-handle"
            onMouseDown={onNameResizeMouseDown}
            onClick={(e) => e.stopPropagation()}
          />
        </th>
        <th
          className="content-column sortable-header"
          onClick={() => onSortChange('pathAndArgs')}
          title="パスはクリックして編集できます。引数は ✏️ 詳細編集から"
        >
          <span className="header-content">
            パスと引数
            {renderSortIndicator('pathAndArgs')}
          </span>
        </th>
        <th className="updated-at-column sortable-header" onClick={() => onSortChange('updatedAt')}>
          <span className="header-content">
            更新日
            {renderSortIndicator('updatedAt')}
          </span>
        </th>
      </tr>
    </thead>
  );
};

export default AdminItemManagerTableHead;
