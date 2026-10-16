import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface WorkspaceHeaderProps {
  isFilterVisible: boolean;
  onToggleFilter: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onAddGroup: () => void;
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
  isPinned,
  onTogglePin,
  onClose,
}) => {
  const { t } = useTranslation();
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
      <h1>{t('workspace.title')}</h1>
      <div className="workspace-header-controls">
        <button
          className={`action-btn workspace-control-btn ${isFilterVisible ? 'active' : ''}`}
          onClick={onToggleFilter}
          title={t('workspace.header.filter')}
        >
          🔍
        </button>
        <button
          className="action-btn workspace-control-btn"
          onClick={onExpandAll}
          title={t('workspace.header.expandAll')}
        >
          🔽
        </button>
        <button
          className="action-btn workspace-control-btn"
          onClick={onCollapseAll}
          title={t('workspace.header.collapseAll')}
        >
          🔼
        </button>
        <button
          className="action-btn workspace-control-btn"
          onClick={onAddGroup}
          title={t('workspace.header.addGroup')}
        >
          ➕
        </button>
        <button
          className={`action-btn workspace-pin-btn ${isPinned ? 'pin-always-on-top' : ''}`}
          onClick={onTogglePin}
          title={isPinned ? t('workspace.header.unpin') : t('workspace.header.pin')}
        >
          📌
        </button>
        <div className="workspace-settings-container" ref={settingsMenuRef}>
          <button
            className={`action-btn workspace-control-btn ${isSettingsMenuOpen ? 'active' : ''}`}
            onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
            title={t('workspace.header.menu')}
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
                {t('workspace.header.openSettings')}
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
                {t('workspace.header.alignLeft')}
              </button>
              <button
                className="workspace-settings-menu-item"
                onClick={() =>
                  handleMenuAction(() =>
                    window.electronAPI.workspaceAPI.setPositionMode('displayRight')
                  )
                }
              >
                {t('workspace.header.alignRight')}
              </button>
              <div className="workspace-settings-menu-divider" />
              <button
                className="workspace-settings-menu-item"
                onClick={() =>
                  handleMenuAction(() => window.electronAPI.workspaceAPI.hideAllDetached())
                }
              >
                {t('workspace.header.hideAllDetached')}
              </button>
              <button
                className="workspace-settings-menu-item"
                onClick={() =>
                  handleMenuAction(() => window.electronAPI.workspaceAPI.showAllDetached())
                }
              >
                {t('workspace.header.showAllDetached')}
              </button>
            </div>
          )}
        </div>
        <button
          className="action-btn workspace-close-btn"
          onClick={onClose}
          title={t('workspace.header.close')}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default WorkspaceHeader;
