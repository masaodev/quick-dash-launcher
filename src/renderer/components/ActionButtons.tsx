import React from 'react';

import type { WindowPinMode } from '../../common/types';

import SettingsDropdown from './SettingsDropdown';
import RefreshActionsDropdown from './RefreshActionsDropdown';

interface ActionButtonsProps {
  onReload: () => void;
  onFetchMissingIcons: () => void;
  onRefreshAll: () => void;
  onTogglePin: () => void;
  onOpenBasicSettings: () => void;
  onOpenItemManagement: () => void;
  windowPinMode: WindowPinMode;
  isEditMode: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  onReload,
  onFetchMissingIcons,
  onRefreshAll,
  onTogglePin,
  onOpenBasicSettings,
  onOpenItemManagement,
  windowPinMode,
  isEditMode,
}) => {
  // 各モードの表示設定
  const getPinButtonConfig = (mode: WindowPinMode) => {
    switch (mode) {
      case 'normal':
        return {
          className: 'action-button pin-normal',
          title: '通常モード → 常に最上面モード',
          emoji: '📌',
        };
      case 'alwaysOnTop':
        return {
          className: 'action-button pin-always-on-top',
          title: '常に最上面モード → 表示固定モード',
          emoji: '📌',
        };
      case 'stayVisible':
        return {
          className: 'action-button pin-stay-visible',
          title: '表示固定モード → 通常モード',
          emoji: '📌',
        };
    }
  };

  const pinConfig = getPinButtonConfig(windowPinMode);
  return (
    <div className="action-buttons">
      <RefreshActionsDropdown
        onReload={onReload}
        onFetchMissingIcons={onFetchMissingIcons}
        onRefreshAll={onRefreshAll}
      />
      <button className={pinConfig.className} onClick={onTogglePin} title={pinConfig.title}>
        {pinConfig.emoji}
      </button>
      <SettingsDropdown
        onOpenBasicSettings={onOpenBasicSettings}
        onOpenItemManagement={onOpenItemManagement}
        onQuitApp={() => window.electronAPI.quitApp()}
        isEditMode={isEditMode}
      />
    </div>
  );
};

export default ActionButtons;
