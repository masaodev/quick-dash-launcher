import { useCallback, Dispatch, SetStateAction } from 'react';
import { DEFAULT_DATA_FILE, AppSettings } from '@common/types';

import { logError } from '../../utils/debug';
import { TabStateCalculator, PendingFileOperations } from '../../utils/tabManager';

interface UseTabOperationsProps {
  editedSettings: AppSettings;
  setEditedSettings: Dispatch<SetStateAction<AppSettings>>;
  pendingFileOperations: PendingFileOperations;
  setPendingFileOperations: Dispatch<SetStateAction<PendingFileOperations>>;
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

interface UseTabOperationsReturn {
  handleMoveTabUp: (tabIndex: number) => void;
  handleMoveTabDown: (tabIndex: number) => void;
  handleTabNameChange: (tabIndex: number, tabName: string) => void;
  handleDeleteTab: (tabIndex: number) => Promise<void>;
}

/**
 * タブ操作フック（移動、削除、名前変更）
 *
 * 責務:
 * - タブの並び替え（上下移動）
 * - タブ名の変更
 * - タブの削除（確認ダイアログ付き）
 */
export function useTabOperations({
  editedSettings,
  setEditedSettings,
  pendingFileOperations,
  setPendingFileOperations,
  showAlert,
  showConfirm,
}: UseTabOperationsProps): UseTabOperationsReturn {
  // タブを移動する共通処理
  const moveTab = useCallback(
    (fromIndex: number, toIndex: number) => {
      const tabs = editedSettings.dataFileTabs || [];
      if (fromIndex < 0 || fromIndex >= tabs.length) return;
      if (toIndex < 0 || toIndex >= tabs.length) return;

      const newTabs = [...tabs];
      [newTabs[fromIndex], newTabs[toIndex]] = [newTabs[toIndex], newTabs[fromIndex]];

      setEditedSettings((prev) => ({
        ...prev,
        dataFileTabs: newTabs,
      }));
    },
    [editedSettings.dataFileTabs, setEditedSettings]
  );

  // タブを上に移動
  const handleMoveTabUp = useCallback(
    (tabIndex: number) => moveTab(tabIndex, tabIndex - 1),
    [moveTab]
  );

  // タブを下に移動
  const handleMoveTabDown = useCallback(
    (tabIndex: number) => moveTab(tabIndex, tabIndex + 1),
    [moveTab]
  );

  // タブ名を変更
  const handleTabNameChange = useCallback(
    (tabIndex: number, tabName: string) => {
      const updatedTabs = [...(editedSettings.dataFileTabs || [])];
      if (tabIndex >= 0 && tabIndex < updatedTabs.length) {
        updatedTabs[tabIndex] = { ...updatedTabs[tabIndex], name: tabName };
        setEditedSettings((prev) => ({
          ...prev,
          dataFileTabs: updatedTabs,
        }));
      }
    },
    [editedSettings.dataFileTabs, setEditedSettings]
  );

  // タブを削除
  const handleDeleteTab = useCallback(
    async (tabIndex: number) => {
      const tabs = editedSettings.dataFileTabs || [];
      if (tabIndex < 0 || tabIndex >= tabs.length) return;

      const tab = tabs[tabIndex];

      // data.jsonを含むタブは削除不可
      if (tab.files.includes(DEFAULT_DATA_FILE)) {
        showAlert(`${DEFAULT_DATA_FILE}を含むタブは削除できません。`, 'warning');
        return;
      }

      const confirmed = await showConfirm(
        `タブ「${tab.name}」を削除しますか？\n\n⚠️ 保存ボタンを押すと、このタブに含まれるデータファイル（${tab.files.join(', ')}）は\nディスクから完全に削除されます。`,
        {
          title: 'タブ削除の確認',
          confirmText: '削除',
          danger: true,
        }
      );

      if (!confirmed) {
        return;
      }

      try {
        // タブを削除（状態更新のみ）
        const updatedTabs = tabs.filter((_, index) => index !== tabIndex);
        setEditedSettings((prev) => ({
          ...prev,
          dataFileTabs: updatedTabs,
        }));

        // TabStateCalculatorを使用して削除対象ファイルを計算
        const filesToDelete = TabStateCalculator.getFilesToDeleteOnTabRemoval(
          tabIndex,
          pendingFileOperations.filesToCreate,
          tabs
        );

        // ファイル操作を更新
        setPendingFileOperations((prev) => ({
          filesToCreate: prev.filesToCreate.filter((f) => !tab.files.includes(f)),
          filesToDelete: [...prev.filesToDelete, ...filesToDelete],
        }));
      } catch (error) {
        logError('タブの削除に失敗しました:', error);
        showAlert('タブの削除に失敗しました。', 'error');
      }
    },
    [
      editedSettings.dataFileTabs,
      setEditedSettings,
      pendingFileOperations.filesToCreate,
      setPendingFileOperations,
      showAlert,
      showConfirm,
    ]
  );

  return {
    handleMoveTabUp,
    handleMoveTabDown,
    handleTabNameChange,
    handleDeleteTab,
  };
}
