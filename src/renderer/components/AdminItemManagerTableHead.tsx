import React from 'react';
import { useTranslation } from 'react-i18next';

import type { SortColumn, SortState } from '../utils/editableItemOperations';
import { activateOnEnterOrSpace } from '../utils/keyboardActivation';

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
  const { t } = useTranslation();
  const sortHint = t('itemManager.table.sortHint');
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
        <th className="actions-column">{t('itemManager.table.actions')}</th>
        <th className="type-column sortable-header" {...sortableProps('type')} title={sortHint}>
          <span className="header-content">
            {t('itemManager.table.type')}
            {renderSortIndicator('type')}
          </span>
        </th>
        <th className="icon-column"></th>
        <th
          className="name-column sortable-header"
          {...sortableProps('displayName')}
          ref={nameHeaderRef}
          style={
            nameColumnWidth !== null
              ? { width: nameColumnWidth, minWidth: nameColumnWidth, maxWidth: nameColumnWidth }
              : undefined
          }
          title={sortHint}
        >
          <span className="header-content">
            {t('itemManager.table.name')}
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
          {...sortableProps('pathAndArgs')}
          title={t('itemManager.table.pathAndArgsTitle')}
        >
          <span className="header-content">
            {t('itemManager.table.pathAndArgs')}
            {renderSortIndicator('pathAndArgs')}
          </span>
        </th>
        <th className="updated-at-column sortable-header" {...sortableProps('updatedAt')}>
          <span className="header-content">
            {t('itemManager.table.updatedAt')}
            {renderSortIndicator('updatedAt')}
          </span>
        </th>
      </tr>
    </thead>
  );
};

export default AdminItemManagerTableHead;
