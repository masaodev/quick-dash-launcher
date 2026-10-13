import React from 'react';
import { useTranslation } from 'react-i18next';

import { useDropdown } from '../hooks/useDropdown';

interface AdminItemManagerHeaderProps {
  onOpenBookmarkImport: () => void;
  onOpenAppImport: () => void;
  /** 一括取込メニュー: 設定「ブックマーク自動取込」を開く */
  onOpenAutoImportSettings?: () => void;
  /** ツールメニュー: リンク切れの確認（押したときだけ確認する） */
  onCheckMissingPaths: () => void;
  checkingMissingPaths: boolean;
  /** ツールメニュー: リンク切れのみ表示（確認した後だけ選べる） */
  missingOnly: boolean;
  missingOnlyAvailable: boolean;
  onToggleMissingOnly: () => void;
  /** ツールメニュー: 重複を削除 */
  onDedupe: () => void;
}

/** アイテム管理のヘッダー: 一括取り込み、ツールメニュー（タブ・データファイルの選択は AdminItemManagerTabBar） */
const AdminItemManagerHeader: React.FC<AdminItemManagerHeaderProps> = ({
  onOpenBookmarkImport,
  onOpenAppImport,
  onOpenAutoImportSettings,
  onCheckMissingPaths,
  checkingMissingPaths,
  missingOnly,
  missingOnlyAvailable,
  onToggleMissingOnly,
  onDedupe,
}) => {
  const { t } = useTranslation();
  const importDropdown = useDropdown();
  const toolsDropdown = useDropdown();

  return (
    <div className="edit-mode-header">
      <div className="edit-mode-info">
        <div className="import-dropdown" ref={importDropdown.ref}>
          <button className="dropdown-trigger-btn" onClick={importDropdown.toggle}>
            <span className="dropdown-trigger-text">{t('itemManager.header.bulkImport')}</span>
            <span className="dropdown-trigger-icon">{importDropdown.isOpen ? '▲' : '▼'}</span>
          </button>
          {importDropdown.isOpen && (
            <div className="dropdown-menu">
              <button
                className="dropdown-item"
                onClick={() => {
                  importDropdown.close();
                  onOpenBookmarkImport();
                }}
              >
                {t('itemManager.header.addBookmarks')}
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  importDropdown.close();
                  onOpenAppImport();
                }}
              >
                {t('itemManager.header.addApps')}
              </button>
              {onOpenAutoImportSettings && (
                <button
                  className="dropdown-item"
                  onClick={() => {
                    importDropdown.close();
                    onOpenAutoImportSettings();
                  }}
                  title={t('itemManager.header.autoImportSettingsTitle')}
                >
                  {t('itemManager.header.autoImportSettings')}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="import-dropdown tools-dropdown" ref={toolsDropdown.ref}>
          <button
            className="dropdown-trigger-btn"
            onClick={toolsDropdown.toggle}
            title={t('itemManager.header.toolsTitle')}
          >
            <span className="dropdown-trigger-text">{t('itemManager.header.tools')}</span>
            <span className="dropdown-trigger-icon">{toolsDropdown.isOpen ? '▲' : '▼'}</span>
          </button>
          {toolsDropdown.isOpen && (
            <div className="dropdown-menu">
              <button
                className="dropdown-item"
                disabled={checkingMissingPaths}
                onClick={() => {
                  toolsDropdown.close();
                  onCheckMissingPaths();
                }}
                title={t('itemManager.header.checkMissingTitle')}
              >
                {checkingMissingPaths
                  ? t('itemManager.header.checkingMissing')
                  : t('itemManager.header.checkMissing')}
              </button>
              <button
                className={`dropdown-item ${missingOnly ? 'selected' : ''}`}
                disabled={!missingOnlyAvailable}
                onClick={() => {
                  toolsDropdown.close();
                  onToggleMissingOnly();
                }}
                title={
                  missingOnlyAvailable
                    ? t('itemManager.header.missingOnlyTitle')
                    : t('itemManager.header.missingOnlyUnavailable')
                }
              >
                {missingOnly ? '☑' : '☐'} {t('itemManager.header.missingOnly')}
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  toolsDropdown.close();
                  onDedupe();
                }}
                title={t('itemManager.header.dedupeTitle')}
              >
                {t('itemManager.header.dedupe')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminItemManagerHeader;
