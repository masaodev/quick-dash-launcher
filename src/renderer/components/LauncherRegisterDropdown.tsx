import React from 'react';
import { useTranslation } from 'react-i18next';

import { useDropdown } from '../hooks/useDropdown';

interface RegisterDropdownProps {
  onOpenRegisterModal: () => void;
}

const LauncherRegisterDropdown: React.FC<RegisterDropdownProps> = ({ onOpenRegisterModal }) => {
  const { t } = useTranslation();
  const dropdown = useDropdown();

  function handleSimpleRegister(): void {
    dropdown.close();
    onOpenRegisterModal();
  }

  function handleImportBookmarks(): void {
    dropdown.close();
    window.electronAPI.openEditWindowWithImportModal('bookmark');
  }

  function handleImportApps(): void {
    dropdown.close();
    window.electronAPI.openEditWindowWithImportModal('app');
  }

  return (
    <div className="settings-dropdown" ref={dropdown.ref}>
      <button
        className="action-btn"
        onClick={dropdown.toggle}
        title={t('launcher.registerMenu.title')}
      >
        ➕
      </button>
      {dropdown.isOpen && (
        <div className="dropdown-menu">
          <button className="dropdown-item" onClick={handleSimpleRegister}>
            {t('launcher.registerMenu.quickAdd')}
          </button>
          <button className="dropdown-item" onClick={handleImportBookmarks}>
            {t('launcher.registerMenu.addBookmarks')}
          </button>
          <button className="dropdown-item" onClick={handleImportApps}>
            {t('launcher.registerMenu.addApps')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LauncherRegisterDropdown;
