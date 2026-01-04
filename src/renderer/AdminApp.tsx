import React, { useState, useEffect, useMemo } from 'react';
import { RawDataLine, AppSettings } from '@common/types';

import { debugInfo, logError } from './utils/debug';
import AdminTabContainer from './components/AdminTabContainer';
import AlertDialog from './components/AlertDialog';

const AdminApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'settings' | 'edit' | 'archive' | 'other'>('settings');
  const [rawLines, setRawLines] = useState<RawDataLine[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // AlertDialog状態管理
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    message: string;
    type?: 'info' | 'error' | 'warning' | 'success';
  }>({
    isOpen: false,
    message: '',
    type: 'info',
  });

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
      loadData(false); // ローディング表示なしで再読み込み
    });

    // ウィンドウ表示時のリスナーを設定
    window.electronAPI.onWindowShown(() => {
      debugInfo('ウィンドウが表示されました、データを再読み込みします');
      loadData(false); // ローディング表示なしで再読み込み
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

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
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
      if (showLoading) {
        setIsLoading(false);
      }
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
          setAlertDialog({
            isOpen: true,
            message: `新しいホットキー「${newSettings.hotkey}」の登録に失敗しました。他のアプリで使用されている可能性があります。`,
            type: 'error',
          });
          return;
        }
        debugInfo(`Hotkey changed successfully to: ${newSettings.hotkey}`);
      }

      setSettings(newSettings);
      debugInfo('Settings saved successfully');
    } catch (error) {
      logError('Failed to save settings:', error);
      setAlertDialog({
        isOpen: true,
        message: '設定の保存に失敗しました。',
        type: 'error',
      });
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  // dataFileTabsをメモ化して、内容が変わらない限り参照を保持
  const dataFileTabs = useMemo(() => {
    return settings?.dataFileTabs || [];
  }, [JSON.stringify(settings?.dataFileTabs)]);

  // dataFileLabelsをメモ化して、内容が変わらない限り参照を保持
  const dataFileLabels = useMemo(() => {
    return settings?.dataFileLabels || {};
  }, [JSON.stringify(settings?.dataFileLabels)]);

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
        dataFileTabs={dataFileTabs}
        dataFileLabels={dataFileLabels}
      />

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        message={alertDialog.message}
        type={alertDialog.type}
      />
    </div>
  );
};

export default AdminApp;
