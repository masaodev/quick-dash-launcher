import React from 'react';
import { RawDataLine, AppSettings, DataFileTab } from '@common/types';

import SettingsTab from './SettingsTab';
import EditModeView from './EditModeView';
import ArchiveTab from './ArchiveTab';
import AdminOtherTab from './AdminOtherTab';

interface AdminTabContainerProps {
  activeTab: 'settings' | 'edit' | 'archive' | 'other';
  onTabChange: (tab: 'settings' | 'edit' | 'archive' | 'other') => void;
  settings: AppSettings | null;
  onSettingsSave: (settings: AppSettings) => Promise<void>;
  rawLines: RawDataLine[];
  onRawDataSave: (rawLines: RawDataLine[]) => Promise<void>;
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
  rawLines,
  onRawDataSave,
  searchQuery,
  onSearchChange,
  dataFileTabs,
  dataFileLabels = {},
}) => {
  const handleTabChange = (newTab: 'settings' | 'edit' | 'archive' | 'other') => {
    onTabChange(newTab);
  };

  const handleExitEditMode = () => {
    window.electronAPI.hideEditWindow();
  };

  return (
    <div className="admin-tab-container">
      <div className="admin-header">
        <div className="admin-tabs">
          <button
            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
          >
            ⚙️ 基本設定
          </button>
          <button
            className={`tab-button ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => handleTabChange('edit')}
          >
            ✏️ アイテム管理
          </button>
          <button
            className={`tab-button ${activeTab === 'archive' ? 'active' : ''}`}
            onClick={() => handleTabChange('archive')}
          >
            📦 アーカイブ
          </button>
          <button
            className={`tab-button ${activeTab === 'other' ? 'active' : ''}`}
            onClick={() => handleTabChange('other')}
          >
            📊 その他
          </button>
        </div>
      </div>

      <div className="admin-content">
        {activeTab === 'settings' && settings && (
          <SettingsTab settings={settings} onSave={onSettingsSave} />
        )}
        {activeTab === 'edit' && (
          <EditModeView
            rawLines={rawLines}
            onRawDataSave={onRawDataSave}
            onExitEditMode={handleExitEditMode}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            dataFileTabs={dataFileTabs}
            dataFileLabels={dataFileLabels}
          />
        )}
        {activeTab === 'archive' && <ArchiveTab />}
        {activeTab === 'other' && <AdminOtherTab />}
      </div>
    </div>
  );
};

export default AdminTabContainer;
