import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface RefreshActionsDropdownProps {
  onReload: () => void;
  onFetchMissingIcons: () => void;
  onFetchMissingIconsCurrentTab: () => void;
  onBookmarkAutoImport: () => void;
  onRefreshAll: () => void;
}

const LauncherRefreshActionsDropdown: React.FC<RefreshActionsDropdownProps> = ({
  onReload,
  onFetchMissingIcons,
  onFetchMissingIconsCurrentTab,
  onBookmarkAutoImport,
  onRefreshAll,
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
        className={`action-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={t('launcher.refreshMenu.title')}
      >
        🔄
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onReload)}>
            {t('launcher.refreshMenu.reloadData')}
          </button>
          <button
            className="dropdown-item"
            onClick={() => handleMenuItemClick(onFetchMissingIconsCurrentTab)}
          >
            {t('launcher.refreshMenu.fetchIconsCurrentTab')}
          </button>
          <button
            className="dropdown-item"
            onClick={() => handleMenuItemClick(onFetchMissingIcons)}
          >
            {t('launcher.refreshMenu.fetchIconsAllTabs')}
          </button>
          <button
            className="dropdown-item"
            onClick={() => handleMenuItemClick(onBookmarkAutoImport)}
          >
            {t('launcher.refreshMenu.importBookmarks')}
          </button>
          <div className="dropdown-divider"></div>
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onRefreshAll)}>
            {t('launcher.refreshMenu.reloadAll')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LauncherRefreshActionsDropdown;
