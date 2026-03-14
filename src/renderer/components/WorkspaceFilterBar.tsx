import React, { useEffect, useRef } from 'react';

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
          placeholder="フィルタ..."
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
        <option value="all">全て</option>
        <option value="group">グループ</option>
        <option value="item">アイテム</option>
      </select>
      <button className="workspace-filter-close-btn" onClick={onClose} title="フィルタを閉じる">
        ×
      </button>
    </div>
  );
};

export default WorkspaceFilterBar;
