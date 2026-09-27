import React from 'react';
import { AppSettings, DataFileTab } from '@common/types';

import type { AdminItemEditing } from '../hooks/useAdminItemEditing';
import type { SettingsCategory } from '../utils/settingsResetKeys';

import AdminSettingsTab from './AdminSettingsTab';
import AdminItemManagerView from './AdminItemManagerView';
import AdminOtherTab from './AdminOtherTab';

interface AdminTabContainerProps {
  activeTab: 'settings' | 'edit' | 'other';
  onTabChange: (tab: 'settings' | 'edit' | 'other') => void;
  settings: AppSettings | null;
  onSettingsSave: (settings: AppSettings) => Promise<void>;
  /** 既定値に戻すなど、保存を経ずに設定が置き換わったとき */
  onSettingsReplaced: (settings: AppSettings) => void;
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
  return (
    <div className="admin-tab-container">
      <div className="admin-header">
        <div className="admin-tabs">
          <button
            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => onTabChange('settings')}
          >
            ⚙️ 基本設定
          </button>
          <button
            className={`tab-button ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => onTabChange('edit')}
          >
            ✏️ アイテム管理{editing.hasUnsavedChanges ? ' *' : ''}
          </button>
          <button
            className={`tab-button ${activeTab === 'other' ? 'active' : ''}`}
            onClick={() => onTabChange('other')}
          >
            📖 ヘルプ
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
          />
        )}
        {activeTab === 'edit' && (
          <AdminItemManagerView
            editing={editing}
            loadError={loadError}
            onExitEditMode={() => window.electronAPI.hideEditWindow()}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            dataFileTabs={dataFileTabs}
            dataFileLabels={dataFileLabels}
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
