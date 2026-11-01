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
          <button
            className="dropdown-item"
            onClick={handleFolderImport}
            title={t('launcher.registerMenu.addFolderImportTitle')}
            data-testid="register-menu-folder-import"
          >
            {t('launcher.registerMenu.addFolderImport')}
          </button>
          <div className="dropdown-divider"></div>
          {/* 上の 2 つはこの場で登録してランチャーに戻る。下の 2 つは管理ウィンドウで開くので、見出しで分ける（A3-237） */}
          <div className="dropdown-section-label" data-testid="register-menu-item-manager-section">
            {t('launcher.registerMenu.itemManagerSection')}
          </div>
          <button
            className="dropdown-item"
            onClick={handleImportBookmarks}
            title={t('launcher.registerMenu.itemManagerImportTitle')}
            data-testid="register-menu-bookmarks"
          >
            {t('launcher.registerMenu.addBookmarks')}
          </button>
          <button
            className="dropdown-item"
            onClick={handleImportApps}
            title={t('launcher.registerMenu.itemManagerImportTitle')}
            data-testid="register-menu-apps"
          >
            {t('launcher.registerMenu.addApps')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LauncherRegisterDropdown;
