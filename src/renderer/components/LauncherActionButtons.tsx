import React from 'react';
import { useTranslation } from 'react-i18next';
import type { WindowPinMode } from '@common/types';

import LauncherSettingsDropdown from './LauncherSettingsDropdown';
import LauncherRefreshActionsDropdown from './LauncherRefreshActionsDropdown';
import LauncherRegisterDropdown from './LauncherRegisterDropdown';

/** ピンモード別のツールチップ（今のモード → 押した後のモード） */
const PIN_MODE_TITLE_KEYS = {
  normal: 'launcher.pinMode.normal',
  alwaysOnTop: 'launcher.pinMode.alwaysOnTop',
  stayVisible: 'launcher.pinMode.stayVisible',
} as const satisfies Record<WindowPinMode, string>;

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
  const { t } = useTranslation();
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
        title={t(PIN_MODE_TITLE_KEYS[windowPinMode])}
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
