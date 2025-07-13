import React, { useState } from 'react';

import { RawDataLine, AppSettings } from '../../common/types';

import SettingsTab from './SettingsTab';
import EditModeView from './EditModeView';
import AdminOtherTab from './AdminOtherTab';

interface AdminTabContainerProps {
  activeTab: 'settings' | 'edit' | 'other';
  onTabChange: (tab: 'settings' | 'edit' | 'other') => void;
  onClose: () => void;
  settings: AppSettings | null;
  onSettingsSave: (settings: AppSettings) => Promise<void>;
  rawLines: RawDataLine[];
  onRawDataSave: (rawLines: RawDataLine[]) => Promise<void>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const AdminTabContainer: React.FC<AdminTabContainerProps> = ({
  activeTab,
  onTabChange,
  onClose,
  settings,
  onSettingsSave,
  rawLines,
  onRawDataSave,
  searchQuery,
  onSearchChange,
}) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleTabChange = (newTab: 'settings' | 'edit' | 'other') => {
    if (hasUnsavedChanges) {
      if (confirm('未保存の変更があります。タブを切り替えますか？')) {
        setHasUnsavedChanges(false);
        onTabChange(newTab);
      }
    } else {
      onTabChange(newTab);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (confirm('未保存の変更があります。ウィンドウを閉じますか？')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleExitEditMode = () => {
    onClose();
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
            ✏️ 編集モード
          </button>
          <button
            className={`tab-button ${activeTab === 'other' ? 'active' : ''}`}
            onClick={() => handleTabChange('other')}
          >
            📊 その他
          </button>
        </div>
        <button className="close-button" onClick={handleClose} title="ウィンドウを閉じる">
          ×
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'settings' && settings && (
          <SettingsTab
            settings={settings}
            onSave={onSettingsSave}
            onUnsavedChanges={setHasUnsavedChanges}
          />
        )}
        {activeTab === 'edit' && (
          <EditModeView
            rawLines={rawLines}
            onRawDataSave={onRawDataSave}
            onExitEditMode={handleExitEditMode}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
          />
        )}
        {activeTab === 'other' && <AdminOtherTab />}
      </div>
    </div>
  );
};

export default AdminTabContainer;
