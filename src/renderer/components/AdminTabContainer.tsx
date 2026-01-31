import React from 'react';
import { AppSettings, DataFileTab } from '@common/types';
import type { EditableJsonItem } from '@common/types/editableItem';

import AdminSettingsTab from './AdminSettingsTab';
import AdminItemManagerView from './AdminItemManagerView';
import AdminArchiveTab from './AdminArchiveTab';
import AdminOtherTab from './AdminOtherTab';

interface AdminTabContainerProps {
  activeTab: 'settings' | 'edit' | 'archive' | 'other';
  onTabChange: (tab: 'settings' | 'edit' | 'archive' | 'other') => void;
  settings: AppSettings | null;
  onSettingsSave: (settings: AppSettings) => Promise<void>;
  editableItems: EditableJsonItem[];
  onEditableItemsSave: (editableItems: EditableJsonItem[]) => Promise<void>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dataFileTabs: DataFileTab[];
  dataFileLabels?: Record<string, string>;
}

const AdminTabContainer: React.FC<AdminTabContainerProps> = ({
  activeTab,
  onTabChange,
  settings,
  onSettingsSave,
  editableItems,
  onEditableItemsSave,
  searchQuery,
  onSearchChange,
  dataFileTabs,
  dataFileLabels = {},
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
            ✏️ アイテム管理
          </button>
          <button
            className={`tab-button ${activeTab === 'archive' ? 'active' : ''}`}
            onClick={() => onTabChange('archive')}
          >
            📦 アーカイブ
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
            editableItems={editableItems}
            onEditableItemsSave={onEditableItemsSave}
            onExitEditMode={() => window.electronAPI.hideEditWindow()}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            dataFileTabs={dataFileTabs}
            dataFileLabels={dataFileLabels}
          />
        )}
        {activeTab === 'archive' && <AdminArchiveTab />}
        {activeTab === 'other' && <AdminOtherTab />}
      </div>
    </div>
  );
};

export default AdminTabContainer;
