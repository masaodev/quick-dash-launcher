import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BookmarkAutoImportRule } from '@common/types';

import { useDropdown } from '../hooks/useDropdown';
import type { AutoImportFilter } from '../utils/editableItemOperations';

/** 取込元の基本の絞り込み（文言は辞書の autoImportFilter） */
const BASIC_FILTERS = [
  { value: 'all', label: 'all' },
  { value: 'auto-import-only', label: 'autoImportOnly' },
  { value: 'manual-only', label: 'manualOnly' },
] as const;

interface AutoImportFilterDropdownProps {
  filter: AutoImportFilter;
  onChange: (filter: AutoImportFilter) => void;
  /** 選択中のデータファイルを取込先とするルール */
  rules: BookmarkAutoImportRule[];
  /** ルール ID → ルール名（別ファイルのルールを選んだ状態でも名前を出すため全ルール分） */
  ruleNames: Map<string, string>;
}

/** 取込元（自動取込ルール）で一覧を絞り込むドロップダウン */
const AutoImportFilterDropdown: React.FC<AutoImportFilterDropdownProps> = ({
  filter,
  onChange,
  rules,
  ruleNames,
}) => {
  const { t } = useTranslation();
  const dropdown = useDropdown();

  const basic = BASIC_FILTERS.find((item) => item.value === filter);
  const label = t('autoImportFilter.label', {
    filter: basic
      ? t(`autoImportFilter.${basic.label}`)
      : (ruleNames.get(filter) ?? t('autoImportFilter.unknownRule')),
  });

  const select = (value: AutoImportFilter) => {
    onChange(value);
    dropdown.close();
  };

  return (
    <div className="auto-import-filter" ref={dropdown.ref}>
      <button
        className="dropdown-trigger-btn"
        onClick={dropdown.toggle}
        title={t('autoImportFilter.title')}
      >
        <span className="dropdown-trigger-text">{label}</span>
        <span className="dropdown-trigger-icon">{dropdown.isOpen ? '▲' : '▼'}</span>
      </button>
      {dropdown.isOpen && (
        <div className="dropdown-menu">
          {BASIC_FILTERS.map(({ value, label: itemLabel }) => (
            <button
              key={value}
              className={`dropdown-item ${filter === value ? 'selected' : ''}`}
              onClick={() => select(value)}
            >
              {t(`autoImportFilter.${itemLabel}`)}
            </button>
          ))}
          {rules.length > 0 && (
            <>
              <div className="dropdown-separator" />
              {rules.map((rule) => (
                <button
                  key={rule.id}
                  className={`dropdown-item ${filter === rule.id ? 'selected' : ''}`}
                  onClick={() => select(rule.id)}
                >
                  {rule.name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AutoImportFilterDropdown;
