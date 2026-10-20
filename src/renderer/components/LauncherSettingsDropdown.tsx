import React from 'react';
import { useTranslation } from 'react-i18next';

import { useDropdown } from '../hooks/useDropdown';

interface SettingsDropdownProps {
  onOpenBasicSettings: () => void;
  onOpenItemManagement: () => void;
  onQuitApp: () => void;
}

const LauncherSettingsDropdown: React.FC<SettingsDropdownProps> = ({
  onOpenBasicSettings,
  onOpenItemManagement,
  onQuitApp,
}) => {
  const { t } = useTranslation();
  const { isOpen, ref: dropdownRef, toggle, close } = useDropdown();

  const handleMenuItemClick = (action: () => void) => {
    action();
    close();
  };

  return (
    <div className="settings-dropdown" ref={dropdownRef}>
      <button
        className={`action-btn ${isOpen ? 'active' : ''}`}
        onClick={toggle}
        title={t('launcher.settingsMenu.title')}
      >
        ⚙️
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          <button
            className="dropdown-item"
            onClick={() => handleMenuItemClick(onOpenBasicSettings)}
            data-testid="settings-menu-settings"
          >
            {t('launcher.settingsMenu.settings')}
          </button>
          <button
            className="dropdown-item"
            onClick={() => handleMenuItemClick(onOpenItemManagement)}
            data-testid="settings-menu-item-manager"
          >
            {t('launcher.settingsMenu.itemManager')}
          </button>
          <div className="dropdown-divider"></div>
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onQuitApp)}>
            {t('launcher.settingsMenu.quit')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LauncherSettingsDropdown;
