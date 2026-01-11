import { useCallback, Dispatch, SetStateAction } from 'react';
import { AppSettings } from '@common/types';
import { logError } from '../../utils/debug';

import { FileNameGenerator, SavedTabState, PendingFileOperations } from '../../utils/tabManager';

interface UseTabPersistenceProps {
  editedSettings: AppSettings;
  setEditedSettings: Dispatch<SetStateAction<AppSettings>>;
  pendingFileOperations: PendingFileOperations;
  setPendingFileOperations: Dispatch<SetStateAction<PendingFileOperations>>;
  savedTabsState: SavedTabState | null;
  setSavedTabsState: Dispatch<SetStateAction<SavedTabState | null>>;
  handleSettingChange: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => Promise<void>;
  showAlert: (message: string, type?: 'info' | 'error' | 'warning' | 'success') => void;
  showConfirm: (
    message: string,
    options?: {
      title?: string;
      confirmText?: string;
      cancelText?: string;
      danger?: boolean;
    }
  ) => Promise<boolean>;
}

interface UseTabPersistenceReturn {
  handleSave: () => Promise<void>;
  handleCancel: (skipConfirmation?: boolean) => Promise<void>;
}

/**
 * タブ管理の永続化フック（保存・キャンセル処理）
 *
 * 責務:
 * - 保存処理（物理ファイル操作含む）
 * - キャンセル処理（変更破棄）
 */
export function useTabPersistence({
  editedSettings,
  setEditedSettings,
  pendingFileOperations,
  setPendingFileOperations,
  savedTabsState,
  setSavedTabsState,
  handleSettingChange,
  showAlert,
  showConfirm,
}: UseTabPersistenceProps): UseTabPersistenceReturn {
  // タブ管理の保存処理
  const handleSave = useCallback(async () => {
    try {
      // 1. 削除予定のファイルを物理削除
      for (const fileName of pendingFileOperations.filesToDelete) {
        await window.electronAPI.deleteDataFile(fileName);
      }

      // 2. 作成予定のファイルを物理作成
      for (const fileName of pendingFileOperations.filesToCreate) {
        const result = await window.electronAPI.createDataFile(fileName);
        if (!result.success) {
          throw new Error(result.error || `${fileName}の作成に失敗しました`);
        }
      }

      // 3. デフォルトラベルが未設定のファイルに対して明示的に設定
      const labels = { ...(editedSettings.dataFileLabels || {}) };
      const tabs = editedSettings.dataFileTabs || [];
      tabs.forEach((tab) => {
        tab.files.forEach((fileName) => {
          if (!labels[fileName] || labels[fileName] === fileName) {
            labels[fileName] = FileNameGenerator.getDefaultFileLabel(fileName, tab.name, tabs);
          }
        });
      });

      // 4. 設定を保存
      await Promise.all([
        handleSettingChange('dataFileTabs', tabs),
        handleSettingChange('dataFileLabels', labels),
      ]);

      // 5. 保存完了後、状態をリセット
      setSavedTabsState({
        dataFileTabs: tabs,
        dataFileLabels: labels,
      });
      setPendingFileOperations({ filesToCreate: [], filesToDelete: [] });

      showAlert('タブ設定を保存しました。', 'success');
    } catch (error) {
      logError('タブ設定の保存に失敗しました:', error);
      showAlert('タブ設定の保存に失敗しました。', 'error');
    }
  }, [
    editedSettings,
    pendingFileOperations,
    handleSettingChange,
    setSavedTabsState,
    setPendingFileOperations,
    showAlert,
  ]);

  // タブ管理のキャンセル処理
  const handleCancel = useCallback(
    async (skipConfirmation = false) => {
      if (!skipConfirmation) {
        const confirmed = await showConfirm('未保存の変更を破棄しますか？', {
          title: 'タブ管理の変更を破棄',
          confirmText: '破棄',
          danger: true,
        });

        if (!confirmed) return;
      }

      // 保存済み状態に戻す
      if (savedTabsState) {
        setEditedSettings((prev) => ({
          ...prev,
          dataFileTabs: savedTabsState.dataFileTabs,
          dataFileLabels: savedTabsState.dataFileLabels,
        }));
      }

      // 保留中のファイル操作をクリア
      setPendingFileOperations({ filesToCreate: [], filesToDelete: [] });

      // 確認ダイアログを表示した場合のみアラートを表示
      if (!skipConfirmation) {
        showAlert('変更を破棄しました。', 'info');
      }
    },
    [savedTabsState, setEditedSettings, setPendingFileOperations, showConfirm, showAlert]
  );

  return {
    handleSave,
    handleCancel,
  };
}
