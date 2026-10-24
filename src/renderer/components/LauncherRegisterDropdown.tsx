import React from 'react';
import { useTranslation } from 'react-i18next';

import { useDropdown } from '../hooks/useDropdown';
import { openAppImport, openBookmarkImport } from '../utils/importEntrances';

interface RegisterDropdownProps {
  onOpenRegisterModal: () => void;
  /** 登録画面をフォルダ取込の種別で開く */
  onOpenFolderImport: () => void;
}

const LauncherRegisterDropdown: React.FC<RegisterDropdownProps> = ({
  onOpenRegisterModal,
  onOpenFolderImport,
}) => {
  const { t } = useTranslation();
  const dropdown = useDropdown();

  function handleSimpleRegister(): void {
    dropdown.close();
    onOpenRegisterModal();
  }

  function handleImportBookmarks(): void {
    dropdown.close();
    openBookmarkImport();
  }

  function handleImportApps(): void {
    dropdown.close();
    openAppImport();
  }

  function handleFolderImport(): void {
    dropdown.close();
    onOpenFolderImport();
  }

  return (
    <div className="settings-dropdown" ref={dropdown.ref}>
      <button
        className={`action-btn ${dropdown.isOpen ? 'toggle-on' : ''}`}
        onClick={dropdown.toggle}
        title={t('launcher.registerMenu.title')}
        data-testid="register-menu-button"
      >
        ➕
      </button>
      {dropdown.isOpen && (
        <div className="dropdown-menu">
          <button
            className="dropdown-item"
            onClick={handleSimpleRegister}
            data-testid="register-menu-quick-add"
          >
            {t('launcher.registerMenu.quickAdd')}
          </button>
          <div className="dropdown-divider"></div>
          <button className="dropdown-item" onClick={handleImportBookmarks}>
            {t('launcher.registerMenu.addBookmarks')}
          </button>
          <button className="dropdown-item" onClick={handleImportApps}>
            {t('launcher.registerMenu.addApps')}
          </button>
          <button
            className="dropdown-item"
            onClick={handleFolderImport}
            title={t('launcher.registerMenu.addFolderImportTitle')}
            data-testid="register-menu-folder-import"
          >
            {t('launcher.registerMenu.addFolderImport')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LauncherRegisterDropdown;
