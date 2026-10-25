import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDropdown } from '../hooks/useDropdown';

interface RefreshActionsDropdownProps {
  /** ツールチップと「データを再読み込み」に F5 を添える（F5 で再読み込みする通常モードだけ。ウィンドウ検索モードの F5 はウィンドウの取り直し） */
  showReloadKey: boolean;
  onReload: () => void;
  onBookmarkAutoImport: () => void;
  /** アイコンをすべて取り直す */
  onRefreshAll: () => void;
}

const LauncherRefreshActionsDropdown: React.FC<RefreshActionsDropdownProps> = ({
  showReloadKey,
  onReload,
  onBookmarkAutoImport,
  onRefreshAll,
}) => {
  const { t } = useTranslation();
  const { isOpen, ref: dropdownRef, toggle, close } = useDropdown();
  // 有効なブックマーク自動取込のルールがあるか（無ければ「ブックマーク自動取込を実行」を出さない。開くたびに確かめる）
  const [hasAutoImportRules, setHasAutoImportRules] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    window.electronAPI.bookmarkAutoImportAPI
      .getSettings()
      .then((settings) => {
        if (active) setHasAutoImportRules(settings.rules.some((rule) => rule.enabled));
      })
      .catch(() => {
        if (active) setHasAutoImportRules(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

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
          {hasAutoImportRules && (
            <button
              className="dropdown-item"
              onClick={() => handleMenuItemClick(onBookmarkAutoImport)}
            >
              {t('launcher.refreshMenu.importBookmarks')}
            </button>
          )}
          <div className="dropdown-divider"></div>
          <button
            className="dropdown-item"
            onClick={() => handleMenuItemClick(onRefreshAll)}
            title={t('launcher.refreshMenu.refetchIconsTitle')}
          >
            {t('launcher.refreshMenu.refetchIcons')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LauncherRefreshActionsDropdown;
