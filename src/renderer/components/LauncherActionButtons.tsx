import React from 'react';
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
}) => {
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
