import React, { useState, useRef, useEffect } from 'react';

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
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };

    if (isSettingsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsMenuOpen]);

  async function handleMenuAction(action: () => Promise<unknown>): Promise<void> {
    await action();
    setIsSettingsMenuOpen(false);
  }

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
        <div className="workspace-settings-container" ref={settingsMenuRef}>
          <button
            className={`workspace-control-btn ${isSettingsMenuOpen ? 'active' : ''}`}
            onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
            title="設定"
          >
            ⚙️
          </button>
          {isSettingsMenuOpen && (
            <div className="workspace-settings-menu">
              <button
                className="workspace-settings-menu-item"
                onClick={() =>
                  handleMenuAction(() => window.electronAPI.openEditWindowWithTab('settings'))
                }
              >
                ⚙️ 基本設定
              </button>
              <div className="workspace-settings-menu-divider" />
              <button
                className="workspace-settings-menu-item"
                onClick={() =>
                  handleMenuAction(() =>
                    window.electronAPI.workspaceAPI.setPositionMode('displayLeft')
                  )
                }
              >
                左端に寄せる
              </button>
              <button
                className="workspace-settings-menu-item"
                onClick={() =>
                  handleMenuAction(() =>
                    window.electronAPI.workspaceAPI.setPositionMode('displayRight')
                  )
                }
              >
                右端に寄せる
              </button>
              <div className="workspace-settings-menu-divider" />
              <button
                className="workspace-settings-menu-item"
                onClick={() =>
                  handleMenuAction(() => window.electronAPI.workspaceAPI.hideAllDetached())
                }
              >
                切り離しウィンドウをすべて非表示
              </button>
              <button
                className="workspace-settings-menu-item"
                onClick={() =>
                  handleMenuAction(() => window.electronAPI.workspaceAPI.showAllDetached())
                }
              >
                切り離しウィンドウをすべて表示
              </button>
            </div>
          )}
        </div>
        <button className="workspace-close-btn" onClick={onClose} title="閉じる">
          ×
        </button>
      </div>
    </div>
  );
};

export default WorkspaceHeader;
