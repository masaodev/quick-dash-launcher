import React from 'react';
import { useTranslation } from 'react-i18next';

import { useDropdown } from '../hooks/useDropdown';
import { describeColumnFilter } from '../utils/adminItemFilterLabels';
import {
  activeFilterColumns,
  type ColumnFilters,
  type FilterableColumnId,
} from '../utils/adminItemFilters';

import { Button } from './ui/Button';

interface AdminItemManagerToolbarProps {
  /** 追加: ボタン本体と「▼」の「一覧に行を追加」 */
  onAddItem: () => void;
  /** 追加「▼」: フォルダ取込のアイテムを追加 */
  onAddFolder: () => void;
  onOpenBookmarkImport: () => void;
  onOpenAppImport: () => void;
  /** 追加「▼」: CSV から取り込む */
  onImportCsv: () => void;
  /** 追加「▼」: 設定「ブックマーク自動取込」を開く */
  onOpenAutoImportSettings?: () => void;

  searchQuery: string;
  onSearchChange: (query: string) => void;

  /** 見出しの ▾ でかけた絞り込み（ツールバーの下にチップで並べる） */
  filters: ColumnFilters;
  onClearColumnFilter: (column: FilterableColumnId) => void;
  onClearAllFilters: () => void;
  /** ルール ID → ルール名（取込元のチップの文言） */
  ruleNames: Map<string, string>;

  /** 整理: リンク切れの確認（押したときだけ確認する） */
  onCheckMissingPaths: () => void;
  checkingMissingPaths: boolean;
  /** 整理: 重複を削除 */
  onDedupe: () => void;
  /** 整理: すべてのタブのアイテムを CSV に書き出す */
  onExportCsv: () => void;

  /** 表示中のうち選択しているアイテムの数。1 件以上なら選択中の操作に切り替える */
  selectedCount: number;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onClearSelection: () => void;

  hasUnsavedChanges: boolean;
  /** 未保存の変更の件数（変更・追加・削除の合計） */
  unsavedCount: number;
  onDiscard: () => void;
  onSave: () => void;
}

/**
 * アイテム管理のツールバー（1 段）
 *
 * 左＝追加・検索・整理（行を選んでいる間は選択中の操作）、右＝保存。
 * 絞り込みは一覧の見出しの ▾ でかけ、かかっている間はその条件を下の段に出して ✕ で外せるようにする。
 * タブ・データファイルの選択は AdminItemManagerTabBar
 */
const AdminItemManagerToolbar: React.FC<AdminItemManagerToolbarProps> = (props) => {
  const { t } = useTranslation();
  const { filters, onClearColumnFilter, onClearAllFilters, ruleNames, selectedCount } = props;
  const activeColumns = activeFilterColumns(filters);

  return (
    <>
      <div className={`edit-mode-toolbar${selectedCount > 0 ? ' is-selecting' : ''}`}>
        {selectedCount > 0 ? (
          <SelectionActions {...props} />
        ) : (
          <div className="toolbar-left">
            <AddSplitButton {...props} />
            <SearchBox {...props} />
            <OrganizeDropdown {...props} />
          </div>
        )}
        <SaveArea {...props} />
      </div>
      {activeColumns.length > 0 && (
        <div className="edit-mode-filter-chips" data-testid="item-filter-chips">
          {activeColumns.map((column) => (
            <FilterChip
              key={column}
              label={describeColumnFilter(column, filters, ruleNames)}
              onRemove={() => onClearColumnFilter(column)}
            />
          ))}
          {activeColumns.length > 1 && (
            <button type="button" className="filter-chips-clear-all" onClick={onClearAllFilters}>
              {t('itemManager.columnFilter.clearAll')}
            </button>
          )}
        </div>
      )}
    </>
  );
};

/** 「＋ アイテムを追加」と、ほかの追加のしかた（取り込みなど）を選ぶ「▼」 */
const AddSplitButton: React.FC<AdminItemManagerToolbarProps> = ({
  onAddItem,
  onAddFolder,
  onOpenBookmarkImport,
  onOpenAppImport,
  onImportCsv,
  onOpenAutoImportSettings,
}) => {
  const { t } = useTranslation();
  const dropdown = useDropdown();
  const choose = (action: () => void) => () => {
    dropdown.close();
    action();
  };

  return (
    <div className="toolbar-dropdown toolbar-split" ref={dropdown.ref}>
      <Button variant="primary" onClick={onAddItem} title={t('itemManager.toolbar.addItemTitle')}>
        {t('itemManager.toolbar.addItem')}
      </Button>
      <Button
        variant="primary"
        className="toolbar-split-toggle"
        onClick={dropdown.toggle}
        aria-label={t('itemManager.toolbar.addMenu')}
        title={t('itemManager.toolbar.addMenu')}
        aria-expanded={dropdown.isOpen}
      >
        <span className="toolbar-split-toggle-icon">▼</span>
      </Button>
      {dropdown.isOpen && (
        <div className="dropdown-menu" role="menu">
          <button className="dropdown-item" onClick={choose(onAddItem)}>
            {t('itemManager.toolbar.addOne')}
          </button>
          <button
            className="dropdown-item"
            onClick={choose(onAddFolder)}
            title={t('itemManager.toolbar.addFolderTitle')}
          >
            {t('itemManager.toolbar.addFolder')}
          </button>
          <div className="dropdown-separator" />
          <button className="dropdown-item" onClick={choose(onOpenBookmarkImport)}>
            {t('itemManager.header.addBookmarks')}
          </button>
          <button className="dropdown-item" onClick={choose(onOpenAppImport)}>
            {t('itemManager.header.addApps')}
          </button>
          <button
            className="dropdown-item"
            onClick={choose(onImportCsv)}
            title={t('itemManager.toolbar.importCsvTitle')}
          >
            {t('itemManager.toolbar.importCsv')}
          </button>
          {onOpenAutoImportSettings && (
            <>
              <div className="dropdown-separator" />
              <button
                className="dropdown-item"
                onClick={choose(onOpenAutoImportSettings)}
                title={t('itemManager.header.autoImportSettingsTitle')}
              >
                {t('itemManager.header.autoImportSettings')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const SearchBox: React.FC<AdminItemManagerToolbarProps> = ({ searchQuery, onSearchChange }) => {
  const { t } = useTranslation();
  return (
    <div className="toolbar-search">
      <div className="search-input-container">
        <input
          type="text"
          placeholder={t('itemManager.toolbar.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button
            className="close-btn close-btn-sm search-clear-button"
            onClick={() => onSearchChange('')}
            type="button"
            aria-label={t('itemManager.toolbar.clearSearch')}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

/** 「整理 ▼」: 一覧の点検・片付け */
const OrganizeDropdown: React.FC<AdminItemManagerToolbarProps> = ({
  onCheckMissingPaths,
  checkingMissingPaths,
  onDedupe,
  onExportCsv,
}) => {
  const { t } = useTranslation();
  const dropdown = useDropdown();

  return (
    <div className="toolbar-dropdown organize-dropdown" ref={dropdown.ref}>
      <button
        className="dropdown-trigger-btn"
        onClick={dropdown.toggle}
        title={t('itemManager.header.toolsTitle')}
        aria-expanded={dropdown.isOpen}
      >
        <span className="dropdown-trigger-text">{t('itemManager.header.tools')}</span>
        <span className="dropdown-trigger-icon">{dropdown.isOpen ? '▲' : '▼'}</span>
      </button>
      {dropdown.isOpen && (
        <div className="dropdown-menu dropdown-menu-right" role="menu">
          <button
            className="dropdown-item"
            disabled={checkingMissingPaths}
            onClick={() => {
              dropdown.close();
              onCheckMissingPaths();
            }}
            title={t('itemManager.header.checkMissingTitle')}
          >
            {checkingMissingPaths
              ? t('itemManager.header.checkingMissing')
              : t('itemManager.header.checkMissing')}
            <small className="dropdown-item-desc">{t('itemManager.header.checkMissingDesc')}</small>
          </button>
          <button
            className="dropdown-item"
            onClick={() => {
              dropdown.close();
              onDedupe();
            }}
            title={t('itemManager.header.dedupeTitle')}
          >
            {t('itemManager.header.dedupe')}
            <small className="dropdown-item-desc">{t('itemManager.header.dedupeDesc')}</small>
          </button>
          <div className="dropdown-separator" />
          <button
            className="dropdown-item"
            onClick={() => {
              dropdown.close();
              onExportCsv();
            }}
          >
            {t('itemManager.header.exportCsv')}
            <small className="dropdown-item-desc">{t('itemManager.header.exportCsvDesc')}</small>
          </button>
        </div>
      )}
    </div>
  );
};

/** 行を選んでいる間の操作（まとめて削除・複製） */
const SelectionActions: React.FC<AdminItemManagerToolbarProps> = ({
  selectedCount,
  onDeleteSelected,
  onDuplicateSelected,
  onClearSelection,
}) => {
  const { t } = useTranslation();
  return (
    <div className="toolbar-left toolbar-selection">
      <span className="toolbar-selection-count">
        {t('itemManager.status.selected', { count: selectedCount })}
      </span>
      <Button
        variant="danger"
        onClick={onDeleteSelected}
        title={t('itemManager.toolbar.deleteSelectedTitle')}
      >
        {t('itemManager.toolbar.deleteSelected')}
      </Button>
      <Button onClick={onDuplicateSelected} title={t('itemManager.toolbar.duplicateSelectedTitle')}>
        {t('itemManager.toolbar.duplicateSelected')}
      </Button>
      <Button className="toolbar-clear-selection" onClick={onClearSelection}>
        {t('itemManager.toolbar.clearSelection')}
      </Button>
    </div>
  );
};

/** 保存: 変更が無ければ「保存済み」だけ、あれば件数と破棄・保存 */
const SaveArea: React.FC<AdminItemManagerToolbarProps> = ({
  hasUnsavedChanges,
  unsavedCount,
  onDiscard,
  onSave,
}) => {
  const { t } = useTranslation();
  return (
    <div className="toolbar-right">
      {hasUnsavedChanges ? (
        <>
          <span className="toolbar-unsaved-count">
            {t('itemManager.toolbar.unsavedCount', { count: unsavedCount })}
          </span>
          <Button variant="secondary" onClick={onDiscard}>
            {t('itemManager.toolbar.discard')}
          </Button>
          <Button variant="primary" onClick={onSave}>
            {t('itemManager.toolbar.save')}
          </Button>
        </>
      ) : (
        <span className="toolbar-saved">{t('itemManager.toolbar.saved')}</span>
      )}
    </div>
  );
};

const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => {
  const { t } = useTranslation();
  return (
    <span className="filter-chip">
      {label}
      <button
        type="button"
        className="filter-chip-remove"
        onClick={onRemove}
        aria-label={t('itemManager.toolbar.removeFilter', { name: label })}
      >
        ×
      </button>
    </span>
  );
};

export default AdminItemManagerToolbar;
