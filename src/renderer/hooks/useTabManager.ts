import { useState, useCallback, Dispatch, SetStateAction } from 'react';
import { AppSettings, DataFileTab } from '@common/types';

interface UseTabManagerProps {
  editedSettings: AppSettings;
  setEditedSettings: Dispatch<SetStateAction<AppSettings>>;
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
  dataFiles: string[];
}

export function useTabManager({
  editedSettings,
  setEditedSettings,
  handleSettingChange,
  showAlert,
  showConfirm,
  dataFiles,
}: UseTabManagerProps) {
  const [fileModalTabIndex, setFileModalTabIndex] = useState<number | null>(null);

  // デフォルトのタブ名を生成（data.txt→メイン, data2.txt→サブ1, data3.txt→サブ2, ...）
  const getDefaultTabName = useCallback((fileName: string): string => {
    if (fileName === 'data.txt') {
      return 'メイン';
    }
    const match = fileName.match(/^data(\d+)\.txt$/);
    if (match) {
      const num = parseInt(match[1]);
      return `サブ${num - 1}`;
    }
    return fileName;
  }, []);

  // タブ名のBlur時の保存処理
  const handleTabNameBlur = useCallback(async () => {
    try {
      await handleSettingChange('dataFileTabs', editedSettings.dataFileTabs || []);
    } catch (error) {
      console.error('タブ名の保存に失敗しました:', error);
      showAlert('タブ名の保存に失敗しました。', 'error');
    }
  }, [editedSettings.dataFileTabs, handleSettingChange, showAlert]);

  // タブを上に移動（インデックスベース）
  const handleMoveTabUp = useCallback(
    (tabIndex: number) => {
      const tabs = editedSettings.dataFileTabs || [];
      if (tabIndex <= 0) return;

      const newTabs = [...tabs];
      [newTabs[tabIndex - 1], newTabs[tabIndex]] = [newTabs[tabIndex], newTabs[tabIndex - 1]];

      handleSettingChange('dataFileTabs', newTabs);
    },
    [editedSettings.dataFileTabs, handleSettingChange]
  );

  // タブを下に移動（インデックスベース）
  const handleMoveTabDown = useCallback(
    (tabIndex: number) => {
      const tabs = editedSettings.dataFileTabs || [];
      if (tabIndex < 0 || tabIndex >= tabs.length - 1) return;

      const newTabs = [...tabs];
      [newTabs[tabIndex], newTabs[tabIndex + 1]] = [newTabs[tabIndex + 1], newTabs[tabIndex]];

      handleSettingChange('dataFileTabs', newTabs);
    },
    [editedSettings.dataFileTabs, handleSettingChange]
  );

  // タブ名を変更（インデックスベース）
  const handleTabNameChangeByIndex = useCallback(
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

  // タブを削除（インデックスベース）
  const handleDeleteTab = useCallback(
    async (tabIndex: number) => {
      const tabs = editedSettings.dataFileTabs || [];
      if (tabIndex < 0 || tabIndex >= tabs.length) return;

      const tab = tabs[tabIndex];
      // data.txtを含むタブは削除不可
      if (tab.files.includes('data.txt')) {
        showAlert('data.txtを含むタブは削除できません。', 'warning');
        return;
      }

      const confirmed = await showConfirm(
        `タブ「${tab.name}」を削除しますか？\nこのタブに含まれる全てのファイルも削除されます。`,
        {
          title: 'タブ削除',
          confirmText: '削除',
          danger: true,
        }
      );

      if (!confirmed) {
        return;
      }

      try {
        // タブに含まれる全ファイルを削除
        for (const fileName of tab.files) {
          await window.electronAPI.deleteDataFile(fileName);
        }

        // タブを削除
        const updatedTabs = tabs.filter((_, index) => index !== tabIndex);
        await handleSettingChange('dataFileTabs', updatedTabs);
      } catch (error) {
        console.error('タブの削除に失敗しました:', error);
        showAlert('タブの削除に失敗しました。', 'error');
      }
    },
    [editedSettings.dataFileTabs, handleSettingChange, showAlert, showConfirm]
  );

  // タブにファイルを追加
  const handleAddFileToTab = useCallback(
    async (tabIndex: number, fileName: string) => {
      const tabs = editedSettings.dataFileTabs || [];
      if (tabIndex < 0 || tabIndex >= tabs.length) return;

      const tab = tabs[tabIndex];
      if (tab.files.includes(fileName)) {
        showAlert('このファイルは既にタブに含まれています。', 'warning');
        return;
      }

      const updatedTabs = [...tabs];
      updatedTabs[tabIndex] = {
        ...tab,
        files: [...tab.files, fileName],
      };

      await handleSettingChange('dataFileTabs', updatedTabs);
    },
    [editedSettings.dataFileTabs, handleSettingChange, showAlert]
  );

  // タブからファイルを削除
  const handleRemoveFileFromTab = useCallback(
    async (tabIndex: number, fileName: string) => {
      const tabs = editedSettings.dataFileTabs || [];
      if (tabIndex < 0 || tabIndex >= tabs.length) return;

      const tab = tabs[tabIndex];

      // data.txtは削除不可
      if (fileName === 'data.txt') {
        showAlert('data.txtは削除できません。', 'warning');
        return;
      }

      // タブに最低1つのファイルが必要
      if (tab.files.length === 1) {
        showAlert('タブには最低1つのファイルが必要です。タブごと削除してください。', 'warning');
        return;
      }

      const confirmed = await showConfirm(
        `${fileName}をタブから削除しますか？\nファイル自体も削除されます。`,
        {
          title: 'ファイル削除',
          confirmText: '削除',
          danger: true,
        }
      );

      if (!confirmed) {
        return;
      }

      try {
        // 物理ファイルを削除
        await window.electronAPI.deleteDataFile(fileName);

        // タブからファイルを削除
        const newFiles = tab.files.filter((f) => f !== fileName);

        const updatedTabs = [...tabs];
        updatedTabs[tabIndex] = {
          ...tab,
          files: newFiles,
        };

        await handleSettingChange('dataFileTabs', updatedTabs);
      } catch (error) {
        console.error('ファイルの削除に失敗しました:', error);
        showAlert('ファイルの削除に失敗しました。', 'error');
      }
    },
    [editedSettings.dataFileTabs, handleSettingChange, showAlert, showConfirm]
  );

  // 新規ファイルを作成してタブに追加
  const handleCreateAndAddFileToTab = useCallback(
    async (tabIndex: number) => {
      // 次のファイル名を自動決定
      const existingNumbers = dataFiles
        .map((file) => {
          if (file === 'data.txt') {
            return 1;
          }
          const match = file.match(/^data(\d+)\.txt$/i);
          return match ? parseInt(match[1]) : null;
        })
        .filter((n): n is number => n !== null);

      const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
      const fileName = `data${nextNumber}.txt`;

      try {
        // 物理ファイルを作成
        const result = await window.electronAPI.createDataFile(fileName);
        if (!result.success) {
          showAlert(result.error || 'ファイルの作成に失敗しました。', 'error');
          return;
        }

        // タブにファイルを追加
        await handleAddFileToTab(tabIndex, fileName);
      } catch (error) {
        console.error('ファイルの作成に失敗しました:', error);
        showAlert('ファイルの作成に失敗しました。', 'error');
      }
    },
    [dataFiles, handleAddFileToTab, showAlert]
  );

  // 新規タブを追加
  const handleAddTab = useCallback(async () => {
    // 新しいファイルを作成
    const existingNumbers = dataFiles
      .map((file) => {
        if (file === 'data.txt') {
          return 1;
        }
        const match = file.match(/^data(\d+)\.txt$/i);
        return match ? parseInt(match[1]) : null;
      })
      .filter((n): n is number => n !== null);

    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
    const fileName = `data${nextNumber}.txt`;

    try {
      // 物理ファイルを作成
      const result = await window.electronAPI.createDataFile(fileName);
      if (!result.success) {
        showAlert(result.error || 'ファイルの作成に失敗しました。', 'error');
        return;
      }

      // 新しいタブを追加
      const newTab: DataFileTab = {
        files: [fileName],
        name: getDefaultTabName(fileName),
      };
      const updatedTabs = [...(editedSettings.dataFileTabs || []), newTab];

      await handleSettingChange('dataFileTabs', updatedTabs);
    } catch (error) {
      console.error('タブの追加に失敗しました:', error);
      showAlert('タブの追加に失敗しました。', 'error');
    }
  }, [dataFiles, editedSettings.dataFileTabs, getDefaultTabName, handleSettingChange, showAlert]);

  // ファイル管理モーダルを開く
  const openFileModal = useCallback((tabIndex: number) => {
    setFileModalTabIndex(tabIndex);
  }, []);

  // ファイル管理モーダルを閉じる
  const closeFileModal = useCallback(() => {
    setFileModalTabIndex(null);
  }, []);

  // データファイル名を取得（表示用）
  const getFileLabel = useCallback(
    (fileName: string): string => {
      const labels = editedSettings.dataFileLabels || {};
      return labels[fileName] || fileName;
    },
    [editedSettings.dataFileLabels]
  );

  // データファイル名を変更
  const handleFileLabelChange = useCallback(
    (fileName: string, label: string) => {
      const labels = { ...(editedSettings.dataFileLabels || {}) };

      // データファイル名は必須なので、空でも設定する（削除しない）
      labels[fileName] = label;

      setEditedSettings((prev) => ({
        ...prev,
        dataFileLabels: labels,
      }));
    },
    [editedSettings.dataFileLabels, setEditedSettings]
  );

  // ファイルラベルのBlur時の保存処理
  const handleFileLabelBlur = useCallback(async () => {
    // 全ての関連ファイルにデータファイル名が設定されているかチェック
    const labels = editedSettings.dataFileLabels || {};
    const allFiles = new Set<string>();
    editedSettings.dataFileTabs.forEach((tab) => {
      tab.files.forEach((fileName) => allFiles.add(fileName));
    });

    const missingLabels = Array.from(allFiles).filter((fileName) => {
      const label = labels[fileName];
      return !label || label.trim() === '';
    });

    if (missingLabels.length > 0) {
      showAlert('データファイル名は必須です。全てのファイルに名前を設定してください。', 'error');
      return;
    }

    try {
      await handleSettingChange('dataFileLabels', editedSettings.dataFileLabels || {});
    } catch (error) {
      console.error('データファイル名の保存に失敗しました:', error);
      showAlert('データファイル名の保存に失敗しました。', 'error');
    }
  }, [editedSettings.dataFileLabels, editedSettings.dataFileTabs, handleSettingChange, showAlert]);

  return {
    fileModalTabIndex,
    getDefaultTabName,
    handleTabNameBlur,
    handleMoveTabUp,
    handleMoveTabDown,
    handleTabNameChangeByIndex,
    handleDeleteTab,
    handleAddFileToTab,
    handleRemoveFileFromTab,
    handleCreateAndAddFileToTab,
    handleAddTab,
    openFileModal,
    closeFileModal,
    getFileLabel,
    handleFileLabelChange,
    handleFileLabelBlur,
  };
}
