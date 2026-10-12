import React, { useState, useEffect, useRef } from 'react';

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
      <button className="action-btn" onClick={() => setIsOpen(!isOpen)} title="設定">
        ⚙️
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          <button
            className="dropdown-item"
            onClick={() => handleMenuItemClick(onOpenBasicSettings)}
          >
            ⚙️ 基本設定
          </button>
          <button
            className="dropdown-item"
            onClick={() => handleMenuItemClick(onOpenItemManagement)}
          >
            ✏️ アイテム管理（Ctrl+E）
          </button>
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onToggleWorkspace)}>
            🗂️ ワークスペースを表示（Ctrl+W）
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

export default LauncherSettingsDropdown;
