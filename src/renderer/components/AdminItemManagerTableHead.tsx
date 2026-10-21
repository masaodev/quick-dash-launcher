import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { VisibleAdminItemColumn } from '../hooks/useAdminItemColumns';
import type { AdminItemColumnId } from '../utils/adminItemColumns';
import type { SortColumn, SortState } from '../utils/editableItemOperations';
import { activateOnEnterOrSpace } from '../utils/keyboardActivation';

interface AdminItemManagerTableHeadProps {
  columns: VisibleAdminItemColumn[];
  sortState: SortState;
  onSortChange: (column: SortColumn) => void;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: (selected: boolean) => void;
  /** 見出しの右端のつまみを押したとき（幅を変える） */
  onResizeStart: (
    e: React.MouseEvent,
    id: AdminItemColumnId,
    th: HTMLTableCellElement | null
  ) => void;
  /** 見出しの右クリック（列のメニューを開く） */
  onHeaderContextMenu: (e: React.MouseEvent) => void;
  /** 絞り込みがかかっている列（▾ を目立たせる） */
  filteredColumns: ReadonlySet<string>;
  /** 見出しの ▾ を押したとき。rect は見出しの位置（メニューを下に出す） */
  onOpenFilter: (id: AdminItemColumnId, rect: DOMRect) => void;
}

/** アイテム管理の一覧の見出し行（全選択・並べ替え・列の幅変更・列のメニュー） */
const AdminItemManagerTableHead: React.FC<AdminItemManagerTableHeadProps> = ({
  columns,
  sortState,
  onSortChange,
  allSelected,
  someSelected,
  onSelectAll,
  onResizeStart,
  onHeaderContextMenu,
  filteredColumns,
  onOpenFilter,
}) => {
  const { t } = useTranslation();
  const headerRefs = useRef(new Map<AdminItemColumnId, HTMLTableCellElement | null>());
  const sortHint = t('itemManager.table.sortHint');
  const columnMenuHint = t('itemManager.table.columnMenuHint');

  /** 見出しをキーボードでも並べ替えられるようにする属性（Tab で移り、Enter／Space で並べ替え） */
  const sortableProps = (column: SortColumn) => ({
    tabIndex: 0,
    'aria-sort':
      sortState.column === column
        ? sortState.direction === 'asc'
          ? ('ascending' as const)
          : ('descending' as const)
        : ('none' as const),
    onClick: () => onSortChange(column),
    onKeyDown: activateOnEnterOrSpace(() => onSortChange(column)),
  });

  const renderSortIndicator = (column: SortColumn): React.ReactNode => {
    const isActive = sortState.column === column;
    const icon = isActive ? (sortState.direction === 'asc' ? '▲' : '▼') : '⇅';
    return <span className={`sort-indicator ${isActive ? 'active' : 'inactive'}`}>{icon}</span>;
  };

  const renderColumnHeader = ({ def, width }: VisibleAdminItemColumn) => {
    const sortColumn = def.sortColumn;
    // アイコン列は見出しの文字を出さない（列のメニューでだけ名前を使う）
    const label = def.id === 'icon' ? '' : t(`itemManager.table.${def.id}`);
    const title =
      def.id === 'pathAndArgs'
        ? `${t('itemManager.table.pathAndArgsTitle')}\n${columnMenuHint}`
        : sortColumn
          ? `${sortHint}\n${columnMenuHint}`
          : columnMenuHint;
    return (
      <th
        key={def.id}
        data-column-id={def.id}
        className={`${def.className}${sortColumn ? ' sortable-header' : ''}${def.minWidth !== undefined ? ' resizable-header' : ''}`}
        {...(sortColumn ? sortableProps(sortColumn) : {})}
        ref={(el) => {
          headerRefs.current.set(def.id, el);
        }}
        style={width !== null ? { width, minWidth: width, maxWidth: width } : undefined}
        title={title}
      >
        {label && (
          <span className="header-content">
            {label}
            {sortColumn && renderSortIndicator(sortColumn)}
          </span>
        )}
        {def.filterable && (
          <button
            type="button"
            className={`column-filter-button${filteredColumns.has(def.id) ? ' is-active' : ''}`}
            aria-label={t('itemManager.columnFilter.open', { column: label || def.id })}
            title={t('itemManager.columnFilter.open', { column: label || def.id })}
            aria-haspopup="menu"
            // 見出しのクリック（並べ替え）・キー操作に届かないようにする
            onClick={(e) => {
              e.stopPropagation();
              const th = headerRefs.current.get(def.id);
              if (th) onOpenFilter(def.id, th.getBoundingClientRect());
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            ▾
          </button>
        )}
        {def.minWidth !== undefined && (
          <div
            className="column-resize-handle"
            onMouseDown={(e) => onResizeStart(e, def.id, headerRefs.current.get(def.id) ?? null)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </th>
    );
  };

  return (
    <thead onContextMenu={onHeaderContextMenu}>
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
        <th className="actions-column" title={columnMenuHint}>
          {t('itemManager.table.actions')}
        </th>
        {columns.map(renderColumnHeader)}
      </tr>
    </thead>
  );
};

export default AdminItemManagerTableHead;
