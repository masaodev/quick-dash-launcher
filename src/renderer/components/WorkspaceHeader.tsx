import React from 'react';

interface WorkspaceHeaderProps {
  isFilterVisible: boolean;
  onToggleFilter: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onAddGroup: () => void;
  onOpenArchive: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
}

const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  isFilterVisible,
  onToggleFilter,
  onExpandAll,
  onCollapseAll,
  onAddGroup,
  onOpenArchive,
  isPinned,
  onTogglePin,
  onClose,
}) => {
  return (
    <div className="workspace-header">
      <h1>Workspace</h1>
      <div className="workspace-header-controls">
        <button
          className={`workspace-control-btn ${isFilterVisible ? 'active' : ''}`}
          onClick={onToggleFilter}
          title="フィルタ"
        >
          🔍
        </button>
        <button className="workspace-control-btn" onClick={onExpandAll} title="全て展開">
          🔽
        </button>
        <button className="workspace-control-btn" onClick={onCollapseAll} title="全て閉じる">
          🔼
        </button>
        <button className="workspace-control-btn" onClick={onAddGroup} title="グループを追加">
          ➕
        </button>
        <button className="workspace-control-btn" onClick={onOpenArchive} title="アーカイブを開く">
          📦
        </button>
        <button
          className={`workspace-pin-btn ${isPinned ? 'pinned' : ''}`}
          onClick={onTogglePin}
          title={isPinned ? 'ピン留めを解除' : 'ピン留めして最前面に固定'}
        >
          📌
        </button>
        <button className="workspace-close-btn" onClick={onClose} title="閉じる">
          ×
        </button>
      </div>
    </div>
  );
};

export default WorkspaceHeader;
