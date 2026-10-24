import React from 'react';
import { useTranslation } from 'react-i18next';

import { useDropdown } from '../hooks/useDropdown';

interface RefreshActionsDropdownProps {
  /** ツールチップと「データを再読み込み」に F5 を添える（F5 で再読み込みする通常モードだけ。ウィンドウ検索モードの F5 はウィンドウの取り直し） */
  showReloadKey: boolean;
  onReload: () => void;
  onFetchMissingIcons: () => void;
  onFetchMissingIconsCurrentTab: () => void;
  onBookmarkAutoImport: () => void;
  onRefreshAll: () => void;
}

const LauncherRefreshActionsDropdown: React.FC<RefreshActionsDropdownProps> = ({
  showReloadKey,
  onReload,
  onFetchMissingIcons,
  onFetchMissingIconsCurrentTab,
  onBookmarkAutoImport,
  onRefreshAll,
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
        className={`action-btn ${isOpen ? 'toggle-on' : ''}`}
        onClick={toggle}
        title={t(
          showReloadKey ? 'launcher.refreshMenu.titleWithReloadKey' : 'launcher.refreshMenu.title'
        )}
      >
        🔄
      </button>
      {isOpen && (
        <div className="dropdown-menu">
          <button className="dropdown-item" onClick={() => handleMenuItemClick(onReload)}>
            {t(
              showReloadKey
                ? 'launcher.refreshMenu.reloadDataWithKey'
                : 'launcher.refreshMenu.reloadData'
            )}
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
