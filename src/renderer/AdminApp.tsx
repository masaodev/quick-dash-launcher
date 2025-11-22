import React, { useState, useEffect } from 'react';

import { RawDataLine, AppSettings } from '../common/types';

import { debugInfo, logError } from './utils/debug';
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

    // データ変更通知のリスナーを設定
    window.electronAPI.onDataChanged(() => {
      debugInfo('データ変更通知を受信、データを再読み込みします');
      loadData();
    });

    // ウィンドウ表示時のリスナーを設定
    window.electronAPI.onWindowShown(() => {
      debugInfo('ウィンドウが表示されました、データを再読み込みします');
      loadData();
    });
  }, []);

  const loadInitialTab = async () => {
    try {
      const initialTab = await window.electronAPI.getInitialTab();
      setActiveTab(initialTab);
    } catch (error) {
      logError('Failed to get initial tab:', error);
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
      logError('Failed to load data:', error);
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
      logError('Failed to save raw data files:', error);
    }
  };

  const handleSettingsSave = async (newSettings: AppSettings) => {
    try {
      // 現在の設定と比較してホットキーが変更されたかチェック
      const isHotkeyChanged = settings && settings.hotkey !== newSettings.hotkey;

      // 設定ファイルを更新
      await window.electronAPI.setMultipleSettings(newSettings);

      // ホットキーが変更された場合は即座に反映
      if (isHotkeyChanged) {
        const success = await window.electronAPI.changeHotkey(newSettings.hotkey);
        if (!success) {
          logError('Failed to register new hotkey:', newSettings.hotkey);
          alert(
            `新しいホットキー「${newSettings.hotkey}」の登録に失敗しました。他のアプリで使用されている可能性があります。`
          );
          return;
        }
        debugInfo(`Hotkey changed successfully to: ${newSettings.hotkey}`);
      }

      setSettings(newSettings);
      debugInfo('Settings saved successfully');
    } catch (error) {
      logError('Failed to save settings:', error);
      alert('設定の保存に失敗しました。');
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
        tabNames={settings?.dataFileTabNames || {}}
      />
    </div>
  );
};

export default AdminApp;
