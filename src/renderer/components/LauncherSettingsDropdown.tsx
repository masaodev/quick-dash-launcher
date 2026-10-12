import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface SettingsDropdownProps {
  onOpenBasicSettings: () => void;
  onOpenItemManagement: () => void;
  onToggleWorkspace: () => void;
  onQuitApp: () => void;
}

const LauncherSettingsDropdown: React.FC<SettingsDropdownProps> = ({
  onOpenBasicSettings,
  onOpenItemManagement,
  onToggleWorkspace,
  onQuitApp,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMenuItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="settings-dropdown" ref={dropdownRef}>
      <button
        className="action-btn"
        onClick={() => setIsOpen(!isOpen)}
        title={t('launcher.settingsMenu.title')}
      >
        ⚙️
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          <button
            className="dropdown-item"
            onClick={() => handleMenuItemClick(onOpenBasicSettings)}
          >
            {t('launcher.settingsMenu.settings')}
          </button>
          <button
            className="dropdown-item"
            onClick={() => handleMenuItemClick(onOpenItemManagement)}
          >
            {t('launcher.settingsMenu.itemManager')}
          </button>
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onToggleWorkspace)}>
            {t('launcher.settingsMenu.toggleWorkspace')}
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
