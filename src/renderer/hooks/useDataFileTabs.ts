import { useState, useEffect } from 'react';
import { AppItem, DataFileTab } from '@common/types';
import { isWindowInfo } from '@common/types/guards';

import { debugLog, logError } from '../utils/debug';

/**
 * データファイルタブ管理フック
 *
 * タブ設定のロード、タブフィルタリング、ファイル存在確認を管理します。
 */
export function useDataFileTabs() {
  const [showDataFileTabs, setShowDataFileTabs] = useState(false);
  const [dataFiles, setDataFiles] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('data.txt');
  const [dataFileTabs, setDataFileTabs] = useState<DataFileTab[]>([]);
  const [dataFileLabels, setDataFileLabels] = useState<Record<string, string>>({});

  /**
   * 設定に登録されているファイルが物理的に存在するか確認し、存在しない場合は作成
   */
  const ensureDataFilesExist = async (fileNames: string[]) => {
    // undefined や空文字列をフィルタリング
    const validFileNames = fileNames.filter((name) => name && typeof name === 'string');
    for (const fileName of validFileNames) {
      try {
        // ファイルが存在するか確認（実際には作成APIを呼ぶだけで、既存ファイルは上書きされない）
        await window.electronAPI.createDataFile(fileName);
      } catch (error) {
        logError(`${fileName}の作成/確認に失敗しました:`, error);
      }
    }
  };

  /**
   * タブ設定をロード
   */
  const loadTabSettings = async () => {
    try {
      const settings = await window.electronAPI.getSettings();

      setShowDataFileTabs(settings.showDataFileTabs);
      setDataFileTabs(settings.dataFileTabs || []);
      setDataFileLabels(settings.dataFileLabels || {});

      // デフォルトタブを設定
      if (settings.defaultFileTab) {
        setActiveTab(settings.defaultFileTab);
      }

      // 設定からデータファイルリストを生成（設定ファイルベース）
      const tabs = settings.dataFileTabs || [];
      // 全タブの全ファイルを統合してユニークなリストを作成
      const allFiles = tabs.flatMap((tab) => tab.files || []);
      const files = Array.from(new Set(allFiles)).filter(
        (file) => file && typeof file === 'string'
      );

      // data.txtが含まれていない場合は追加
      if (!files.includes('data.txt')) {
        files.unshift('data.txt');
      }

      setDataFiles(files);

      // 物理ファイルが存在しない場合は自動作成
      await ensureDataFilesExist(files);

      // タブ表示がOFFの場合は、data.txtのみ表示
      if (!settings.showDataFileTabs) {
        setActiveTab('data.txt');
      } else {
        // アクティブタブが存在するか確認、存在しない場合はdata.txtにフォールバック
        const defaultTab = settings.defaultFileTab || 'data.txt';
        if (files.includes(defaultTab)) {
          setActiveTab(defaultTab);
        } else if (files.includes('data.txt')) {
          setActiveTab('data.txt');
        } else if (files.length > 0) {
          setActiveTab(files[0]);
        }
      }
    } catch (error) {
      logError('タブ設定のロードに失敗しました:', error);
    }
  };

  /**
   * 設定変更通知リスナーとwindow-hiddenイベントリスナーを設定
   */
  useEffect(() => {
    // 初期ロード
    loadTabSettings();

    // ウィンドウ非表示時にデフォルトタブに戻す（次回表示時に既にリセット済みにするため）
    const cleanupWindowHidden = window.electronAPI.onWindowHidden(async () => {
      debugLog('ウィンドウ非表示通知を受信、デフォルトタブに戻します');
      await resetToDefaultTab();
    });

    // 設定変更通知のリスナーを設定
    const cleanupSettingsChanged = window.electronAPI.onSettingsChanged(async () => {
      debugLog('設定変更通知を受信、タブ設定を再読み込みします');
      const settings = await window.electronAPI.getSettings();
      setShowDataFileTabs(settings.showDataFileTabs);
      setDataFileTabs(settings.dataFileTabs || []);

      // 設定からデータファイルリストを再生成（設定ファイルベース）
      const tabs = settings.dataFileTabs || [];
      // 全タブの全ファイルを統合してユニークなリストを作成
      const allFiles = tabs.flatMap((tab) => tab.files || []);
      const files = Array.from(new Set(allFiles)).filter(
        (file) => file && typeof file === 'string'
      );

      // data.txtが含まれていない場合は追加
      if (!files.includes('data.txt')) {
        files.unshift('data.txt');
      }

      setDataFiles(files);

      // 物理ファイルが存在しない場合は自動作成
      await ensureDataFilesExist(files);

      // アクティブタブが削除されていた場合のフォールバック
      setActiveTab((prevTab) => {
        if (!files.includes(prevTab)) {
          if (files.includes('data.txt')) {
            return 'data.txt';
          } else if (files.length > 0) {
            return files[0];
          }
        }
        return prevTab;
      });

      // デフォルトタブが変更されていたら反映
      if (settings.defaultFileTab && settings.defaultFileTab !== activeTab) {
        if (files.includes(settings.defaultFileTab)) {
          setActiveTab(settings.defaultFileTab);
        }
      }
    });

    return () => {
      cleanupWindowHidden();
      cleanupSettingsChanged();
    };
  }, []);

  /**
   * タブクリックハンドラ
   */
  const handleTabClick = (fileName: string) => {
    setActiveTab(fileName);
  };

  /**
   * アクティブなタブに基づいてアイテムをフィルタリング
   */
  const getTabFilteredItems = (mainItems: AppItem[]): AppItem[] => {
    if (!showDataFileTabs) {
      // タブ表示OFF: data.txtのみ表示
      return mainItems.filter((item) => !isWindowInfo(item) && item.sourceFile === 'data.txt');
    }
    // タブ表示ON: アクティブなタブに紐付く全ファイルのアイテムを表示
    // アクティブなタブの設定を検索
    const activeTabConfig = dataFileTabs.find((tab) => tab.files.includes(activeTab));
    if (activeTabConfig) {
      // タブに紐付く全ファイルのアイテムを取得
      return mainItems.filter(
        (item) => !isWindowInfo(item) && activeTabConfig.files.includes(item.sourceFile || '')
      );
    }
    // フォールバック: アクティブタブと一致するファイルのアイテムのみ
    return mainItems.filter((item) => !isWindowInfo(item) && item.sourceFile === activeTab);
  };

  /**
   * デフォルトタブに戻す（メイン画面再表示時に呼び出す）
   */
  const resetToDefaultTab = async () => {
    try {
      const settings = await window.electronAPI.getSettings();

      // タブ表示がOFFの場合はdata.txtに戻す
      if (!settings.showDataFileTabs) {
        setActiveTab('data.txt');
        return;
      }

      // タブ表示がONの場合はdefaultFileTabに戻す
      const defaultTab = settings.defaultFileTab || 'data.txt';

      // 設定から最新のファイルリストを再生成（クロージャで古い値を参照しないため）
      const tabs = settings.dataFileTabs || [];
      const allFiles = tabs.flatMap((tab) => tab.files || []);
      const files = Array.from(new Set(allFiles)).filter(
        (file) => file && typeof file === 'string'
      );

      // data.txtが含まれていない場合は追加
      if (!files.includes('data.txt')) {
        files.unshift('data.txt');
      }

      if (files.includes(defaultTab)) {
        setActiveTab(defaultTab);
      } else if (files.includes('data.txt')) {
        setActiveTab('data.txt');
      } else if (files.length > 0) {
        setActiveTab(files[0]);
      }
    } catch (error) {
      logError('デフォルトタブへのリセットに失敗しました:', error);
    }
  };

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
