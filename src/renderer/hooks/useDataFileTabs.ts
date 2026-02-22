import { useState, useEffect } from 'react';
import { DEFAULT_DATA_FILE, AppItem, AppSettings, DataFileTab } from '@common/types';
import { isWindowInfo } from '@common/types/guards';

import { debugLog, logError } from '../utils/debug';

/**
 * タブ設定から全ファイルのユニークリストを生成
 * data.jsonが含まれていない場合は先頭に追加
 */
function extractUniqueFiles(tabs: DataFileTab[]): string[] {
  const allFiles = tabs.flatMap((tab) => tab.files || []);
  const files = Array.from(new Set(allFiles)).filter((file) => file && typeof file === 'string');

  if (!files.includes(DEFAULT_DATA_FILE)) {
    files.unshift(DEFAULT_DATA_FILE);
  }

  return files;
}

/**
 * ファイルリストから有効なアクティブタブを決定
 */
function resolveActiveTab(files: string[], preferredTab: string): string {
  if (files.includes(preferredTab)) {
    return preferredTab;
  }
  if (files.includes(DEFAULT_DATA_FILE)) {
    return DEFAULT_DATA_FILE;
  }
  return files[0] || DEFAULT_DATA_FILE;
}

/**
 * データファイルタブ管理フック
 */
export function useDataFileTabs() {
  const [showDataFileTabs, setShowDataFileTabs] = useState(false);
  const [dataFiles, setDataFiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_DATA_FILE);
  const [dataFileTabs, setDataFileTabs] = useState<DataFileTab[]>([]);
  const [dataFileLabels, setDataFileLabels] = useState<Record<string, string>>({});

  async function ensureDataFilesExist(fileNames: string[]): Promise<void> {
    for (const fileName of fileNames) {
      try {
        await window.electronAPI.createDataFile(fileName);
      } catch (error) {
        logError(`${fileName}の作成/確認に失敗しました:`, error);
      }
    }
  }

  async function applySettings(
    settings: AppSettings,
    options: { resetToDefault?: boolean } = {}
  ): Promise<void> {
    setShowDataFileTabs(settings.showDataFileTabs);
    setDataFileTabs(settings.dataFileTabs || []);
    setDataFileLabels(settings.dataFileLabels || {});

    const files = extractUniqueFiles(settings.dataFileTabs || []);
    setDataFiles(files);

    await ensureDataFilesExist(files);

    const defaultTab = settings.defaultFileTab || DEFAULT_DATA_FILE;

    if (options.resetToDefault) {
      setActiveTab(resolveActiveTab(files, defaultTab));
    } else {
      setActiveTab((prevTab) => {
        if (!files.includes(prevTab)) {
          return resolveActiveTab(files, defaultTab);
        }
        return prevTab;
      });
    }
  }

  useEffect(() => {
    async function loadTabSettings(): Promise<void> {
      try {
        const settings = await window.electronAPI.getSettings();
        await applySettings(settings, { resetToDefault: true });
      } catch (error) {
        logError('タブ設定のロードに失敗しました:', error);
      }
    }

    loadTabSettings();

    const cleanupWindowHidden = window.electronAPI.onWindowHidden(async () => {
      debugLog('ウィンドウ非表示通知を受信、デフォルトタブに戻します');
      try {
        const settings = await window.electronAPI.getSettings();
        const files = extractUniqueFiles(settings.dataFileTabs || []);
        const defaultTab = settings.defaultFileTab || DEFAULT_DATA_FILE;
        setActiveTab(resolveActiveTab(files, defaultTab));
      } catch (error) {
        logError('デフォルトタブへのリセットに失敗しました:', error);
      }
    });

    const cleanupSettingsChanged = window.electronAPI.onSettingsChanged(async () => {
      debugLog('設定変更通知を受信、タブ設定を再読み込みします');
      try {
        const settings = await window.electronAPI.getSettings();
        await applySettings(settings);
      } catch (error) {
        logError('設定の再読み込みに失敗しました:', error);
      }
    });

    return () => {
      cleanupWindowHidden();
      cleanupSettingsChanged();
    };
  }, []);

  function handleTabClick(fileName: string): void {
    setActiveTab(fileName);
  }

  function getTabFilteredItems(mainItems: AppItem[]): AppItem[] {
    const activeTabConfig = showDataFileTabs
      ? dataFileTabs.find((tab) => tab.files.includes(activeTab))
      : undefined;

    if (activeTabConfig) {
      return mainItems.filter(
        (item) => !isWindowInfo(item) && activeTabConfig.files.includes(item.sourceFile || '')
      );
    }

    return mainItems.filter((item) => !isWindowInfo(item) && item.sourceFile === activeTab);
  }

  return {
    showDataFileTabs,
    dataFiles,
    activeTab,
    dataFileTabs,
    dataFileLabels,
    setActiveTab,
    handleTabClick,
    getTabFilteredItems,
  };
}
