import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminTab, AppSettings, DataFileTab } from '@common/types';

import type { AdminItemEditing } from '../hooks/useAdminItemEditing';
import type { TabStructureSettings } from '../hooks/useAdminTabStructure';
import type { SettingsCategory } from '../utils/settingsResetKeys';

import AdminSettingsTab from './AdminSettingsTab';
import AdminItemManagerView from './AdminItemManagerView';
import AdminOtherTab from './AdminOtherTab';

interface AdminTabContainerProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  settings: AppSettings | null;
  onSettingsSave: (settings: AppSettings) => Promise<void>;
  /** 既定値に戻すなど、保存を経ずに設定が置き換わったとき */
  onSettingsReplaced: (settings: AppSettings) => void;
  /** アイテム管理でタブ・データファイルの構成を保存したとき */
  onTabStructureSaved: (settings: Partial<TabStructureSettings>) => void;
  /** アイテム管理の編集状態（AdminApp が持つ。タブを切り替えても消えない） */
  editing: AdminItemEditing;
  /** データファイルの読み込みエラー（あれば一覧の代わりに表示する） */
  loadError: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dataFileTabs: DataFileTab[];
  dataFileLabels?: Record<string, string>;
  pendingImportModal: 'bookmark' | 'app' | null;
  onClearPendingImportModal: () => void;
  /** 設定タブで開いているカテゴリ（AdminApp が持つ。他のタブから指定して開ける） */
  settingsCategory: SettingsCategory;
  onSettingsCategoryChange: (category: SettingsCategory) => void;
  /** 設定タブの指定カテゴリを開く（手動取込 → 自動取込の設定） */
  onOpenSettingsCategory: (category: SettingsCategory) => void;
  /** アイテム管理タブで手動のブックマーク取込を開く（自動取込の設定 → 一度だけ取り込む） */
  onOpenManualBookmarkImport: () => void;
}

const AdminTabContainer: React.FC<AdminTabContainerProps> = ({
  activeTab,
  onTabChange,
  settings,
  onSettingsSave,
  onSettingsReplaced,
  onTabStructureSaved,
  editing,
  loadError,
  searchQuery,
  onSearchChange,
  dataFileTabs,
  dataFileLabels = {},
  pendingImportModal,
  onClearPendingImportModal,
  settingsCategory,
  onSettingsCategoryChange,
  onOpenSettingsCategory,
  onOpenManualBookmarkImport,
}) => {
  const { t } = useTranslation();
  return (
    <div className="admin-tab-container">
      <div className="admin-header">
        <div className="admin-tabs">
          <button
            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => onTabChange('settings')}
          >
            {t('admin.tabs.settings')}
          </button>
          <button
            className={`tab-button ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => onTabChange('edit')}
          >
            {t('admin.tabs.itemManager')}
            {editing.hasUnsavedChanges ? ' *' : ''}
          </button>
          <button
            className={`tab-button ${activeTab === 'other' ? 'active' : ''}`}
            onClick={() => onTabChange('other')}
          >
            {t('admin.tabs.help')}
          </button>
        </div>
      </div>

      <div className="admin-content">
        {activeTab === 'settings' && settings && (
          <AdminSettingsTab
            settings={settings}
            onSave={onSettingsSave}
            onSettingsReplaced={onSettingsReplaced}
            selectedCategory={settingsCategory}
            onSelectCategory={onSettingsCategoryChange}
            onOpenManualBookmarkImport={onOpenManualBookmarkImport}
            onTabStructureSaved={onTabStructureSaved}
          />
        )}
        {activeTab === 'edit' && (
          <AdminItemManagerView
            editing={editing}
            loadError={loadError}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            dataFileTabs={dataFileTabs}
            dataFileLabels={dataFileLabels}
            showDataFileTabs={settings?.showDataFileTabs ?? false}
            onTabStructureSaved={onTabStructureSaved}
            pendingImportModal={pendingImportModal}
            onClearPendingImportModal={onClearPendingImportModal}
            onOpenAutoImportSettings={() => onOpenSettingsCategory('bookmarkAutoImport')}
          />
        )}
        {activeTab === 'other' && <AdminOtherTab />}
      </div>
    </div>
  );
};

export default AdminTabContainer;
