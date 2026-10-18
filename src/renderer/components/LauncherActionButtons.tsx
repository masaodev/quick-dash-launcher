import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PinLevel } from '@common/types';

import LauncherSettingsDropdown from './LauncherSettingsDropdown';
import LauncherRefreshActionsDropdown from './LauncherRefreshActionsDropdown';
import LauncherRegisterDropdown from './LauncherRegisterDropdown';
import PinButton from './PinButton';

interface ActionButtonsProps {
  onReload: () => void;
  onFetchMissingIcons: () => void;
  onFetchMissingIconsCurrentTab: () => void;
  onBookmarkAutoImport: () => void;
  onRefreshAll: () => void;
  onOpenBasicSettings: () => void;
  onOpenItemManagement: () => void;
  onToggleWorkspace: () => void;
  onOpenRegisterModal: () => void;
  pinLevel: PinLevel;
  /** ワークスペースが開いているか（⭐ ボタンを押し込んだ見た目にする） */
  isWorkspaceOpen: boolean;
  onPinLevelChange: (level: PinLevel) => void;
}

const LauncherActionButtons: React.FC<ActionButtonsProps> = ({
  onReload,
  onFetchMissingIcons,
  onFetchMissingIconsCurrentTab,
  onBookmarkAutoImport,
  onRefreshAll,
  onOpenBasicSettings,
  onOpenItemManagement,
  onToggleWorkspace,
  onOpenRegisterModal,
  pinLevel,
  onPinLevelChange,
  isWorkspaceOpen,
}) => {
  const { t } = useTranslation();
  const workspaceTitle = t(
    isWorkspaceOpen ? 'launcher.workspaceButton.close' : 'launcher.workspaceButton.open'
  );

  return (
    <div className="action-buttons">
      <LauncherRefreshActionsDropdown
        onReload={onReload}
        onFetchMissingIcons={onFetchMissingIcons}
        onFetchMissingIconsCurrentTab={onFetchMissingIconsCurrentTab}
        onBookmarkAutoImport={onBookmarkAutoImport}
        onRefreshAll={onRefreshAll}
      />
      <LauncherRegisterDropdown onOpenRegisterModal={onOpenRegisterModal} />
      <button
        className={`action-btn toggle-btn ${isWorkspaceOpen ? 'toggle-on' : ''}`}
        onClick={onToggleWorkspace}
        title={workspaceTitle}
        aria-label={workspaceTitle}
        aria-pressed={isWorkspaceOpen}
      >
        <span className="action-btn-glyph">⭐</span>
      </button>
      <PinButton level={pinLevel} onLevelChange={onPinLevelChange} />
      <LauncherSettingsDropdown
        onOpenBasicSettings={onOpenBasicSettings}
        onOpenItemManagement={onOpenItemManagement}
        onToggleWorkspace={onToggleWorkspace}
        onQuitApp={() => window.electronAPI.quitApp()}
      />
    </div>
  );
};

export default LauncherActionButtons;
