import React from 'react';

import { useDropdown } from '../hooks/useDropdown';

interface RegisterDropdownProps {
  onOpenRegisterModal: () => void;
}

const LauncherRegisterDropdown: React.FC<RegisterDropdownProps> = ({ onOpenRegisterModal }) => {
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
      <button className="action-btn" onClick={dropdown.toggle} title="アイテムを登録">
        ➕
      </button>
      {dropdown.isOpen && (
        <div className="dropdown-menu">
          <button className="dropdown-item" onClick={handleSimpleRegister}>
            📄 簡易登録
          </button>
          <button className="dropdown-item" onClick={handleImportBookmarks}>
            🔖 ブラウザのブックマークを追加
          </button>
          <button className="dropdown-item" onClick={handleImportApps}>
            💻 インストール済みアプリを追加
          </button>
        </div>
      )}
    </div>
  );
};

export default LauncherRegisterDropdown;
