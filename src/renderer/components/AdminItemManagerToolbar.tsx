import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BookmarkAutoImportRule } from '@common/types';

import { useDropdown } from '../hooks/useDropdown';
import type { AutoImportFilter } from '../utils/editableItemOperations';

import { Button } from './ui/Button';

/** 取込元の基本の絞り込み（文言は辞書の autoImportFilter） */
const BASIC_FILTERS = [
  { value: 'all', label: 'all' },
  { value: 'auto-import-only', label: 'autoImportOnly' },
  { value: 'manual-only', label: 'manualOnly' },
] as const;

interface AdminItemManagerToolbarProps {
  /** 追加: ボタン本体と「▼」の「一覧に行を追加」 */
  onAddItem: () => void;
  /** 追加「▼」: フォルダ取込のアイテムを追加 */
  onAddFolder: () => void;
  onOpenBookmarkImport: () => void;
  onOpenAppImport: () => void;
  /** 追加「▼」: 設定「ブックマーク自動取込」を開く */
  onOpenAutoImportSettings?: () => void;

  searchQuery: string;
  onSearchChange: (query: string) => void;

  /** 絞り込み: 取込元（自動取込ルール） */
  autoImportFilter: AutoImportFilter;
  onAutoImportFilterChange: (filter: AutoImportFilter) => void;
  /** 選択中のデータファイルを取込先とするルール */
  rules: BookmarkAutoImportRule[];
  /** ルール ID → ルール名（別ファイルのルールを選んだ状態でも名前を出すため全ルール分） */
  ruleNames: Map<string, string>;
  /** 絞り込み: リンク切れだけ表示（確認した後だけ選べる） */
  missingOnly: boolean;
  missingOnlyAvailable: boolean;
  onToggleMissingOnly: () => void;

  /** 整理: リンク切れの確認（押したときだけ確認する） */
  onCheckMissingPaths: () => void;
  checkingMissingPaths: boolean;
  /** 整理: 重複を削除 */
  onDedupe: () => void;

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
 * 左＝追加・検索・絞り込み・整理（行を選んでいる間は選択中の操作）、右＝保存。
 * 絞り込みがかかっている間は、その条件を下の段に出して ✕ で外せるようにする。
 * タブ・データファイルの選択は AdminItemManagerTabBar
 */
const AdminItemManagerToolbar: React.FC<AdminItemManagerToolbarProps> = (props) => {
  const { t } = useTranslation();
  const {
    autoImportFilter,
    onAutoImportFilterChange,
    ruleNames,
    missingOnly,
    onToggleMissingOnly,
    selectedCount,
  } = props;

  const sourceFilterLabel = (() => {
    const basic = BASIC_FILTERS.find((item) => item.value === autoImportFilter);
    return basic
      ? t(`autoImportFilter.${basic.label}`)
      : (ruleNames.get(autoImportFilter) ?? t('autoImportFilter.unknownRule'));
  })();
  const activeFilterCount = (autoImportFilter !== 'all' ? 1 : 0) + (missingOnly ? 1 : 0);

  return (
    <>
      <div className={`edit-mode-toolbar${selectedCount > 0 ? ' is-selecting' : ''}`}>
        {selectedCount > 0 ? (
          <SelectionActions {...props} />
        ) : (
          <div className="toolbar-left">
            <AddSplitButton {...props} />
            <SearchBox {...props} />
            <FilterDropdown {...props} activeCount={activeFilterCount} />
            <OrganizeDropdown {...props} />
          </div>
        )}
        <SaveArea {...props} />
      </div>
      {activeFilterCount > 0 && (
        <div className="edit-mode-filter-chips" data-testid="item-filter-chips">
          {autoImportFilter !== 'all' && (
            <FilterChip
              label={t('autoImportFilter.label', { filter: sourceFilterLabel })}
              onRemove={() => onAutoImportFilterChange('all')}
            />
          )}
          {missingOnly && (
            <FilterChip
              label={t('itemManager.toolbar.missingOnlyChip')}
              onRemove={onToggleMissingOnly}
            />
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

/** 「絞り込み ▼」: 取込元とリンク切れだけ表示 */
const FilterDropdown: React.FC<AdminItemManagerToolbarProps & { activeCount: number }> = ({
  autoImportFilter,
  onAutoImportFilterChange,
  rules,
  missingOnly,
  missingOnlyAvailable,
  onToggleMissingOnly,
  activeCount,
}) => {
  const { t } = useTranslation();
  const dropdown = useDropdown();
  const select = (value: AutoImportFilter) => {
    onAutoImportFilterChange(value);
    dropdown.close();
  };

  return (
    <div className="toolbar-dropdown filter-dropdown" ref={dropdown.ref}>
      <button
        className={`dropdown-trigger-btn${activeCount > 0 ? ' is-active' : ''}`}
        onClick={dropdown.toggle}
        title={t('itemManager.toolbar.filterTitle')}
        aria-expanded={dropdown.isOpen}
      >
        <span className="dropdown-trigger-text">
          {activeCount > 0
            ? t('itemManager.toolbar.filterActive', { count: activeCount })
            : t('itemManager.toolbar.filter')}
        </span>
        <span className="dropdown-trigger-icon">{dropdown.isOpen ? '▲' : '▼'}</span>
      </button>
      {dropdown.isOpen && (
        <div className="dropdown-menu" role="menu">
          <div className="dropdown-section-label">{t('itemManager.toolbar.filterSource')}</div>
          {BASIC_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              className={`dropdown-item ${autoImportFilter === value ? 'selected' : ''}`}
              onClick={() => select(value)}
            >
              {t(`autoImportFilter.${label}`)}
            </button>
          ))}
          {rules.map((rule) => (
            <button
              key={rule.id}
              className={`dropdown-item ${autoImportFilter === rule.id ? 'selected' : ''}`}
              onClick={() => select(rule.id)}
            >
              {rule.name}
            </button>
          ))}
          <div className="dropdown-separator" />
          <div className="dropdown-section-label">{t('itemManager.toolbar.filterShow')}</div>
          <button
            className={`dropdown-item ${missingOnly ? 'selected' : ''}`}
            disabled={!missingOnlyAvailable}
            onClick={() => {
              dropdown.close();
              onToggleMissingOnly();
            }}
            title={
              missingOnlyAvailable
                ? t('itemManager.header.missingOnlyTitle')
                : t('itemManager.header.missingOnlyUnavailable')
            }
          >
            {missingOnly ? '☑' : '☐'} {t('itemManager.header.missingOnly')}
          </button>
        </div>
      )}
    </div>
  );
};

/** 「整理 ▼」: 一覧の点検・片付け */
const OrganizeDropdown: React.FC<AdminItemManagerToolbarProps> = ({
  onCheckMissingPaths,
  checkingMissingPaths,
  onDedupe,
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
