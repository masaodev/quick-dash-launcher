import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_DATA_FILE, AppItem, AppSettings, DataFileTab } from '@common/types';
import { isWindowInfo } from '@common/types/guards';

import { debugLog, logError } from '../utils/debug';
import { getActiveTabFiles } from '../utils/tabFiles';

import { useToast } from './useToast';

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
  /** 前に読んだ「複数タブを表示」（切り替わったかを見るため） */
  const lastShowDataFileTabs = useRef<boolean | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>(DEFAULT_DATA_FILE);
  const [dataFileTabs, setDataFileTabs] = useState<DataFileTab[]>([]);
  const [dataFileLabels, setDataFileLabels] = useState<Record<string, string>>({});

  const { t } = useTranslation();
  const { showError } = useToast();

  /** タブ設定にあるデータファイルを、無ければ作る。作れなかったものは画面に知らせる */
  async function ensureDataFilesExist(fileNames: string[]): Promise<void> {
    const failed: string[] = [];
    for (const fileName of fileNames) {
      try {
        const result = await window.electronAPI.createDataFile(fileName);
        if (!result.success && !result.alreadyExists) {
          logError(`${fileName}を作成できませんでした:`, result.error);
          failed.push(
            t('common.withReason', {
              name: fileName,
              reason: result.error ?? t('common.unknownReason'),
            })
          );
        }
      } catch (error) {
        logError(`${fileName}の作成/確認に失敗しました:`, error);
        failed.push(fileName);
      }
    }
    if (failed.length > 0) {
      showError(
        t('launcher.messages.dataFilesCreateFailed', {
          files: failed.join(t('common.listSeparator')),
        }),
        {
          id: 'data-file-create-error', // 設定の再適用のたびに重ねて出さない
          long: true,
        }
      );
    }
  }

  async function applySettings(
    settings: AppSettings,
    options: { resetToDefault?: boolean } = {}
  ): Promise<void> {
    lastShowDataFileTabs.current = settings.showDataFileTabs;
    setShowDataFileTabs(settings.showDataFileTabs);
    setDataFileTabs(settings.dataFileTabs || []);
    setDataFileLabels(settings.dataFileLabels || {});

    const files = extractUniqueFiles(settings.dataFileTabs || []);

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
        // 「複数タブを表示」を切り替えたら最初のタブに戻す（オフにしたのに、見ていたタブの中身が残らないように）
        const tabsToggled =
          lastShowDataFileTabs.current !== undefined &&
          lastShowDataFileTabs.current !== settings.showDataFileTabs;
        await applySettings(settings, { resetToDefault: tabsToggled });
      } catch (error) {
        logError('設定の再読み込みに失敗しました:', error);
      }
    });

    return () => {
      cleanupWindowHidden();
      cleanupSettingsChanged();
    };
  }, []);

  const getTabFilteredItems = useCallback(
    (mainItems: AppItem[]): AppItem[] => {
      const files = getActiveTabFiles(dataFileTabs, activeTab);
      return mainItems.filter(
        (item) => !isWindowInfo(item) && files.includes(item.sourceFile || '')
      );
    },
    [dataFileTabs, activeTab]
  );

  return {
    showDataFileTabs,
    activeTab,
    dataFileTabs,
    dataFileLabels,
    setActiveTab,
    getTabFilteredItems,
  };
}
