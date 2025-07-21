import React, { useState, useEffect, useRef } from 'react';

interface SettingsDropdownProps {
  onOpenConfigFolder: () => void;
  onOpenDataFile: () => void;
  onExportJson: () => void;
  onOpenBasicSettings: () => void;
  onOpenItemManagement: () => void;
  onQuitApp: () => void;
  isEditMode: boolean;
}

const SettingsDropdown: React.FC<SettingsDropdownProps> = ({
  onOpenConfigFolder,
  onOpenDataFile,
  onExportJson,
  onOpenBasicSettings,
  onOpenItemManagement,
  onQuitApp,
  isEditMode: _isEditMode,
}) => {
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
      <button className="action-button" onClick={() => setIsOpen(!isOpen)} title="設定">
        ⚙
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onOpenBasicSettings)}>
            ⚙️ 基本設定
          </button>
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onOpenItemManagement)}>
            ✏️ アイテム管理
          </button>
          <div className="dropdown-divider"></div>
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onOpenConfigFolder)}>
            📁 設定フォルダを開く
          </button>
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onOpenDataFile)}>
            📄 設定ファイルを開く
          </button>
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onExportJson)}>
            📋 JSON出力
          </button>
          <div className="dropdown-divider"></div>
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onQuitApp)}>
            🚪 アプリを終了
          </button>
        </div>
      )}
    </div>
  );
};

export default SettingsDropdown;
