import React, { useState, useEffect } from 'react';

import { RawDataLine } from '../common/types';

import EditModeView from './components/EditModeView';

const EditApp: React.FC = () => {
  const [rawLines, setRawLines] = useState<RawDataLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await window.electronAPI.loadRawDataFiles();
      setRawLines(data);
    } catch (error) {
      console.error('Failed to load raw data files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRawDataSave = async (newRawLines: RawDataLine[]) => {
    try {
      await window.electronAPI.saveRawDataFiles(newRawLines);
      setRawLines(newRawLines);
      console.log('Raw data files saved successfully');
    } catch (error) {
      console.error('Failed to save raw data files:', error);
    }
  };

  const handleExitEditMode = () => {
    // 編集ウィンドウを閉じる
    window.electronAPI.hideEditWindow();
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
    <div className="edit-app">
      <EditModeView
        rawLines={rawLines}
        onRawDataSave={handleRawDataSave}
        onExitEditMode={handleExitEditMode}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
      />
    </div>
  );
};

export default EditApp;