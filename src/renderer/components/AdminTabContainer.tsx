import React from 'react';
import { AppSettings, DataFileTab } from '@common/types';

import type { AdminItemEditing } from '../hooks/useAdminItemEditing';

import AdminSettingsTab from './AdminSettingsTab';
import AdminItemManagerView from './AdminItemManagerView';
import AdminOtherTab from './AdminOtherTab';

interface AdminTabContainerProps {
  activeTab: 'settings' | 'edit' | 'other';
  onTabChange: (tab: 'settings' | 'edit' | 'other') => void;
  settings: AppSettings | null;
  onSettingsSave: (settings: AppSettings) => Promise<void>;
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
}

const AdminTabContainer: React.FC<AdminTabContainerProps> = ({
  activeTab,
  onTabChange,
  settings,
  onSettingsSave,
  editing,
  loadError,
  searchQuery,
  onSearchChange,
  dataFileTabs,
  dataFileLabels = {},
  pendingImportModal,
  onClearPendingImportModal,
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
          <AdminSettingsTab settings={settings} onSave={onSettingsSave} />
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
          />
        )}
        {activeTab === 'other' && <AdminOtherTab />}
      </div>
    </div>
  );
};

export default AdminTabContainer;
