import React from 'react';

import SettingsDropdown from './SettingsDropdown';
import RefreshActionsDropdown from './RefreshActionsDropdown';

interface ActionButtonsProps {
  onReload: () => void;
  onFetchMissingIcons: () => void;
  onRefreshAll: () => void;
  onAddTemp: () => void;
  onOpenConfigFolder: () => void;
  onOpenDataFile: () => void;
  onTogglePin: () => void;
  onExportJson: () => void;
  onToggleEditMode: () => void;
  onOpenSettings: () => void;
  isPinned: boolean;
  isEditMode: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onReload,
  onFetchMissingIcons,
  onRefreshAll,
  onAddTemp,
  onOpenConfigFolder,
  onOpenDataFile,
  onTogglePin,
  onExportJson,
  onToggleEditMode,
  onOpenSettings,
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
      <button className="action-button" onClick={onAddTemp} title="一時タブに追加">
        ✔️
      </button>
      <button
        className={`action-button ${isPinned ? 'pinned' : ''}`}
        onClick={onTogglePin}
        title={isPinned ? '固定解除' : 'ウィンドウを固定'}
      >
        📌
      </button>
      <SettingsDropdown
        onOpenConfigFolder={onOpenConfigFolder}
        onOpenDataFile={onOpenDataFile}
        onExportJson={onExportJson}
        onToggleEditMode={onToggleEditMode}
        onQuitApp={() => window.electronAPI.quitApp()}
        onOpenSettings={onOpenSettings}
        isEditMode={isEditMode}
      />
    </div>
  );
};

export default ActionButtons;
