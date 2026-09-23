import React from 'react';
import type { BookmarkAutoImportRule } from '@common/types';

import { useDropdown } from '../hooks/useDropdown';
import type { AutoImportFilter } from '../utils/editableItemOperations';

const BASIC_FILTERS = [
  { value: 'all', label: '全て' },
  { value: 'auto-import-only', label: '自動取込のみ' },
  { value: 'manual-only', label: '手動登録のみ' },
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
  const dropdown = useDropdown();

  const label = (() => {
    switch (filter) {
      case 'all':
        return '取込元: 全て';
      case 'auto-import-only':
        return '取込元: 自動取込のみ';
      case 'manual-only':
        return '取込元: 手動登録のみ';
      default:
        return `取込元: ${ruleNames.get(filter) ?? '不明なルール'}`;
    }
  })();

  const select = (value: AutoImportFilter) => {
    onChange(value);
    dropdown.close();
  };

  return (
    <div className="auto-import-filter" ref={dropdown.ref}>
      <button className="dropdown-trigger-btn" onClick={dropdown.toggle} title="自動取込フィルタ">
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
              {itemLabel}
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
