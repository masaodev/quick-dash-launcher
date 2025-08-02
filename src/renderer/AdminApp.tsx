import React, { useState, useEffect } from 'react';

import { RawDataLine, AppSettings } from '../common/types';

import { debugInfo } from './utils/debug';
import AdminTabContainer from './components/AdminTabContainer';

const AdminApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'settings' | 'edit' | 'other'>('settings');
  const [rawLines, setRawLines] = useState<RawDataLine[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
    loadInitialTab();

    // タブ変更イベントをリッスン
    window.electronAPI.onSetActiveTab((tab) => {
      setActiveTab(tab);
    });
  }, []);

  const loadInitialTab = async () => {
    try {
      const initialTab = await window.electronAPI.getInitialTab();
      setActiveTab(initialTab);
    } catch (error) {
      console.error('Failed to get initial tab:', error);
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      // 設定とデータを並行して読み込み
      const [settingsData, rawData] = await Promise.all([
        window.electronAPI.getSettings(),
        window.electronAPI.loadRawDataFiles(),
      ]);
      setSettings(settingsData);
      setRawLines(rawData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRawDataSave = async (newRawLines: RawDataLine[]) => {
    try {
      await window.electronAPI.saveRawDataFiles(newRawLines);
      setRawLines(newRawLines);
      debugInfo('Raw data files saved successfully');
    } catch (error) {
      console.error('Failed to save raw data files:', error);
    }
  };

  const handleSettingsSave = async (newSettings: AppSettings) => {
    try {
      await window.electronAPI.setMultipleSettings(newSettings);
      setSettings(newSettings);
      debugInfo('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-message">データを読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="admin-app">
      <AdminTabContainer
        activeTab={activeTab}
        onTabChange={setActiveTab}
        settings={settings}
        onSettingsSave={handleSettingsSave}
        rawLines={rawLines}
        onRawDataSave={handleRawDataSave}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
      />
    </div>
  );
};

export default AdminApp;
