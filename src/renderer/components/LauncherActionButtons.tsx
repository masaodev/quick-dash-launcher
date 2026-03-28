import React from 'react';
import type { WindowPinMode } from '@common/types';

import LauncherSettingsDropdown from './LauncherSettingsDropdown';
import LauncherRefreshActionsDropdown from './LauncherRefreshActionsDropdown';
import LauncherRegisterDropdown from './LauncherRegisterDropdown';

interface ActionButtonsProps {
  onReload: () => void;
  onFetchMissingIcons: () => void;
  onFetchMissingIconsCurrentTab: () => void;
  onBookmarkAutoImport: () => void;
  onRefreshAll: () => void;
  onTogglePin: () => void;
  onOpenBasicSettings: () => void;
  onOpenItemManagement: () => void;
  onToggleWorkspace: () => void;
  onOpenRegisterModal: () => void;
  windowPinMode: WindowPinMode;
}

const LauncherActionButtons: React.FC<ActionButtonsProps> = ({
  onReload,
  onFetchMissingIcons,
  onFetchMissingIconsCurrentTab,
  onBookmarkAutoImport,
  onRefreshAll,
  onTogglePin,
  onOpenBasicSettings,
  onOpenItemManagement,
  onToggleWorkspace,
  onOpenRegisterModal,
  windowPinMode,
}) => {
  // ピンモード別のクラス名を取得
  // normal: デフォルトのaction-btnスタイルを使用
  // alwaysOnTop/stayVisible: 専用の色付きスタイルを適用
  function getPinModeClassName(mode: WindowPinMode): string {
    switch (mode) {
      case 'alwaysOnTop':
        return 'action-btn pin-always-on-top';
      case 'stayVisible':
        return 'action-btn pin-stay-visible';
      default:
        return 'action-btn';
    }
  }

  // ピンモード別のツールチップを取得
  function getPinModeTitle(mode: WindowPinMode): string {
    switch (mode) {
      case 'normal':
        return '通常モード → 常に最上面モード';
      case 'alwaysOnTop':
        return '常に最上面モード → 表示固定モード';
      case 'stayVisible':
        return '表示固定モード → 通常モード';
    }
  }

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
        className={getPinModeClassName(windowPinMode)}
        onClick={onTogglePin}
        title={getPinModeTitle(windowPinMode)}
      >
        📌
      </button>
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
