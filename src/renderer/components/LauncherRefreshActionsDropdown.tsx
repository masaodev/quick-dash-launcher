import React, { useState, useEffect, useRef } from 'react';

interface RefreshActionsDropdownProps {
  onReload: () => void;
  onFetchMissingIcons: () => void;
  onFetchMissingIconsCurrentTab: () => void;
  onRefreshAll: () => void;
}

const LauncherRefreshActionsDropdown: React.FC<RefreshActionsDropdownProps> = ({
  onReload,
  onFetchMissingIcons,
  onFetchMissingIconsCurrentTab,
  onRefreshAll,
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
      <button className="action-btn" onClick={() => setIsOpen(!isOpen)} title="更新・取得">
        🔄
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onReload)}>
            📋 データ再読込
          </button>
          <button
            className="dropdown-item"
            onClick={() => handleMenuItemClick(onFetchMissingIconsCurrentTab)}
          >
            🎨 アイコン取得（現在のタブ）
          </button>
          <button
            className="dropdown-item"
            onClick={() => handleMenuItemClick(onFetchMissingIcons)}
          >
            🎨 アイコン取得（全タブ）
          </button>
          <div className="dropdown-divider"></div>
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onRefreshAll)}>
            🔄 完全リフレッシュ
          </button>
        </div>
      )}
    </div>
  );
};

export default LauncherRefreshActionsDropdown;
