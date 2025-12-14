import React from 'react';

/**
 * WorkspaceHeaderコンポーネントのProps
 */
interface WorkspaceHeaderProps {
  /** 全て展開ボタンクリック時のハンドラー */
  onExpandAll: () => void;
  /** 全て閉じるボタンクリック時のハンドラー */
  onCollapseAll: () => void;
  /** グループ追加ボタンクリック時のハンドラー */
  onAddGroup: () => void;
  /** ピン留め状態 */
  isPinned: boolean;
  /** ピン留めボタンクリック時のハンドラー */
  onTogglePin: () => void;
}

/**
 * ワークスペースウィンドウのヘッダーコンポーネント
 *
 * タイトルと各種コントロールボタン（全展開、全閉じ、グループ追加、ピン留め）を表示します。
 *
 * @param props コンポーネントのprops
 * @returns ヘッダーコンポーネント
 */
const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  onExpandAll,
  onCollapseAll,
  onAddGroup,
  isPinned,
  onTogglePin,
}) => {
  return (
    <div className="workspace-header">
      <h1>Workspace</h1>
      <div className="workspace-header-controls">
        <button className="workspace-control-btn" onClick={onExpandAll} title="全て展開">
          🔽
        </button>
        <button className="workspace-control-btn" onClick={onCollapseAll} title="全て閉じる">
          🔼
        </button>
        <button className="workspace-control-btn" onClick={onAddGroup} title="グループを追加">
          ➕
        </button>
        <button
          className={`workspace-pin-btn ${isPinned ? 'pinned' : ''}`}
          onClick={onTogglePin}
          title={isPinned ? 'ピン留めを解除' : 'ピン留めして最前面に固定'}
        >
          📌
        </button>
      </div>
    </div>
  );
};

export default WorkspaceHeader;
