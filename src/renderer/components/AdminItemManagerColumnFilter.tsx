import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BookmarkAutoImportRule } from '@common/types';

import {
  TYPE_FILTER_KEYS,
  UPDATED_AT_FILTERS,
  type ColumnFilters,
  type FilterableColumnId,
  type LinkFilter,
  type TextFilter,
  type TypeFilterKey,
} from '../utils/adminItemFilters';
import type { SortColumn, SortState } from '../utils/editableItemOperations';

const LINK_FILTERS: readonly LinkFilter[] = ['missing', 'exists', 'unknown'];

export interface ColumnFilterOptions {
  /** 選んでいるデータファイルを取込先とする自動取込ルール（取込元の選択肢） */
  rules: BookmarkAutoImportRule[];
  /** 「リンク切れを確認」を実行したか（リンクの選択肢はその後だけ選べる） */
  linkChecked: boolean;
}

interface AdminItemManagerColumnFilterProps {
  column: FilterableColumnId;
  /** 見出しの左下（メニューを出す位置） */
  position: { x: number; y: number };
  filters: ColumnFilters;
  onChange: <K extends FilterableColumnId>(column: K, value: ColumnFilters[K] | undefined) => void;
  /** この列で並べ替えられるとき、その項目 */
  sortColumn?: SortColumn;
  sortState: SortState;
  onSort: (column: SortColumn, direction: SortState['direction']) => void;
  options: ColumnFilterOptions;
  onClose: () => void;
}

/**
 * 見出しの ▾ で出す、その列の絞り込みと並べ替えのメニュー
 *
 * 選ぶとすぐ一覧に効く（「適用」ボタンは無い）。外側のクリックと Escape で閉じる
 */
const AdminItemManagerColumnFilter: React.FC<AdminItemManagerColumnFilterProps> = ({
  column,
  position,
  filters,
  onChange,
  sortColumn,
  sortState,
  onSort,
  options,
  onClose,
}) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  const choice = (selected: boolean, label: React.ReactNode, onClick: () => void, key: string) => (
    <button
      key={key}
      className={`dropdown-item${selected ? ' selected' : ''}`}
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
    >
      {label}
    </button>
  );

  const renderTypeFilter = () => {
    const selected = filters.type ?? [];
    const toggle = (key: TypeFilterKey) => {
      const next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
      onChange('type', next.length > 0 ? next : undefined);
    };
    return (
      <>
        {TYPE_FILTER_KEYS.map((key) => (
          <button
            key={key}
            className="dropdown-item"
            role="menuitemcheckbox"
            aria-checked={selected.includes(key)}
            onClick={() => toggle(key)}
          >
            {selected.includes(key) ? '☑' : '☐'} {t(`itemManager.columnFilter.types.${key}`)}
          </button>
        ))}
      </>
    );
  };

  const renderTextFilter = (target: 'name' | 'pathAndArgs' | 'memo') => {
    const value: TextFilter | undefined = filters[target];
    const text = value?.mode === 'contains' ? value.text : '';
    return (
      <>
        <div className="column-filter-text">
          <input
            type="text"
            className="column-filter-input"
            value={text}
            placeholder={t('itemManager.columnFilter.containsPlaceholder')}
            onChange={(e) =>
              onChange(
                target,
                e.target.value.length > 0 ? { mode: 'contains', text: e.target.value } : undefined
              )
            }
            autoFocus
          />
        </div>
        {/* 名前・パスは空にならないので、空かどうかの絞り込みはメモだけ */}
        {target === 'memo' && (
          <>
            {choice(
              value?.mode === 'nonEmpty',
              t('itemManager.columnFilter.nonEmpty'),
              () => onChange('memo', value?.mode === 'nonEmpty' ? undefined : { mode: 'nonEmpty' }),
              'nonEmpty'
            )}
            {choice(
              value?.mode === 'empty',
              t('itemManager.columnFilter.empty'),
              () => onChange('memo', value?.mode === 'empty' ? undefined : { mode: 'empty' }),
              'empty'
            )}
          </>
        )}
      </>
    );
  };

  const renderSourceFilter = () => {
    const value = filters.source;
    const pick = (next: string) => onChange('source', value === next ? undefined : next);
    return (
      <>
        {choice(
          value === 'manual-only',
          t('autoImportFilter.manualOnly'),
          () => pick('manual-only'),
          'manual'
        )}
        {choice(
          value === 'auto-import-only',
          t('autoImportFilter.autoImportOnly'),
          () => pick('auto-import-only'),
          'auto'
        )}
        {options.rules.length > 0 && (
          <>
            <div className="dropdown-separator" />
            <div className="dropdown-section-label">{t('itemManager.columnFilter.rules')}</div>
            {options.rules.map((rule) =>
              choice(value === rule.id, rule.name, () => pick(rule.id), rule.id)
            )}
          </>
        )}
      </>
    );
  };

  const renderLinkFilter = () => {
    const value = filters.link;
    return (
      <>
        {!options.linkChecked && (
          <div className="dropdown-section-label column-filter-note">
            {t('itemManager.columnFilter.linkNotChecked')}
          </div>
        )}
        {LINK_FILTERS.map((key) => (
          <button
            key={key}
            className={`dropdown-item${value === key ? ' selected' : ''}`}
            role="menuitemradio"
            aria-checked={value === key}
            disabled={!options.linkChecked}
            onClick={() => onChange('link', value === key ? undefined : key)}
          >
            {t(`itemManager.columnFilter.link.${key}`)}
          </button>
        ))}
      </>
    );
  };

  const renderUpdatedAtFilter = () => {
    const value = filters.updatedAt;
    return (
      <>
        {UPDATED_AT_FILTERS.map((key) =>
          choice(
            value === key,
            t(`itemManager.columnFilter.updatedAt.${key}`),
            () => onChange('updatedAt', value === key ? undefined : key),
            key
          )
        )}
      </>
    );
  };

  const renderBody = () => {
    switch (column) {
      case 'type':
        return renderTypeFilter();
      case 'name':
      case 'pathAndArgs':
      case 'memo':
        return renderTextFilter(column);
      case 'source':
        return renderSourceFilter();
      case 'link':
        return renderLinkFilter();
      case 'updatedAt':
        return renderUpdatedAtFilter();
    }
  };

  return (
    <div
      ref={ref}
      className="admin-popover"
      data-testid="admin-column-filter"
      style={{ left: position.x, top: position.y }}
    >
      <div className="dropdown-menu column-filter-menu" role="menu">
        {sortColumn && (
          <>
            {choice(
              sortState.column === sortColumn && sortState.direction === 'asc',
              t('itemManager.columnFilter.sortAsc'),
              () => onSort(sortColumn, 'asc'),
              'asc'
            )}
            {choice(
              sortState.column === sortColumn && sortState.direction === 'desc',
              t('itemManager.columnFilter.sortDesc'),
              () => onSort(sortColumn, 'desc'),
              'desc'
            )}
            <div className="dropdown-separator" />
          </>
        )}
        <div className="dropdown-section-label">{t('itemManager.columnFilter.title')}</div>
        {renderBody()}
        <div className="dropdown-separator" />
        <button
          className="dropdown-item"
          disabled={filters[column] === undefined}
          onClick={() => {
            onChange(column, undefined);
            onClose();
          }}
        >
          {t('itemManager.columnFilter.clear')}
        </button>
      </div>
    </div>
  );
};

export default AdminItemManagerColumnFilter;
