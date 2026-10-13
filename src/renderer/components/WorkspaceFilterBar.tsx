import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { FilterScope } from '../hooks/useWorkspaceFilter';

interface WorkspaceFilterBarProps {
  filterText: string;
  onFilterTextChange: (text: string) => void;
  filterScope: FilterScope;
  onFilterScopeChange: (scope: FilterScope) => void;
  onClose: () => void;
  focusTrigger?: number;
}

const WorkspaceFilterBar: React.FC<WorkspaceFilterBarProps> = ({
  filterText,
  onFilterTextChange,
  filterScope,
  onFilterScopeChange,
  onClose,
  focusTrigger,
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [focusTrigger]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="workspace-filter-bar">
      <div className="workspace-filter-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="workspace-filter-input"
          placeholder={t('workspace.filter.placeholder')}
          value={filterText}
          onChange={(e) => onFilterTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <select
        className="workspace-filter-scope"
        value={filterScope}
        onChange={(e) => onFilterScopeChange(e.target.value as FilterScope)}
      >
        <option value="all">{t('workspace.filter.scopes.all')}</option>
        <option value="group">{t('workspace.filter.scopes.group')}</option>
        <option value="item">{t('workspace.filter.scopes.item')}</option>
      </select>
      <button
        className="close-btn close-btn-sm workspace-filter-close-btn"
        onClick={onClose}
        title={t('workspace.filter.close')}
      >
        ×
      </button>
    </div>
  );
};

export default WorkspaceFilterBar;
