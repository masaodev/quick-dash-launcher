import React from 'react';

import SettingsDropdown from './SettingsDropdown';
import RefreshActionsDropdown from './RefreshActionsDropdown';

interface ActionButtonsProps {
  onReload: () => void;
  onFetchMissingIcons: () => void;
  onRefreshAll: () => void;
  onTogglePin: () => void;
  onExportJson: () => void;
  onOpenBasicSettings: () => void;
  onOpenItemManagement: () => void;
  isPinned: boolean;
  isEditMode: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onReload,
  onFetchMissingIcons,
  onRefreshAll,
  onTogglePin,
  onExportJson,
  onOpenBasicSettings,
  onOpenItemManagement,
  isPinned,
  isEditMode,
}) => {
  return (
    <div className="action-buttons">
      <RefreshActionsDropdown
        onReload={onReload}
        onFetchMissingIcons={onFetchMissingIcons}
        onRefreshAll={onRefreshAll}
      />
      <button
        className={`action-button ${isPinned ? 'pinned' : ''}`}
        onClick={onTogglePin}
        title={isPinned ? '固定解除' : 'ウィンドウを固定'}
      >
        📌
      </button>
      <SettingsDropdown
        onOpenBasicSettings={onOpenBasicSettings}
        onOpenItemManagement={onOpenItemManagement}
        onExportJson={onExportJson}
        onQuitApp={() => window.electronAPI.quitApp()}
        isEditMode={isEditMode}
      />
    </div>
  );
};

export default ActionButtons;
