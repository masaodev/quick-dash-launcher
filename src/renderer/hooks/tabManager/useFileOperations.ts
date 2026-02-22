import { useCallback, Dispatch, SetStateAction } from 'react';
import { AppSettings, DataFileTab } from '@common/types';

import {
  FileNameGenerator,
  TabValidator,
  TabStateCalculator,
  PendingFileOperations,
} from '../../utils/tabManager';

interface UseFileOperationsProps {
  editedSettings: AppSettings;
  setEditedSettings: Dispatch<SetStateAction<AppSettings>>;
  pendingFileOperations: PendingFileOperations;
  setPendingFileOperations: Dispatch<SetStateAction<PendingFileOperations>>;
  setExpandedTabs: Dispatch<SetStateAction<Set<number>>>;
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

interface UseFileOperationsReturn {
  handleAddFileToTab: (tabIndex: number, fileName: string) => void;
  handleRemoveFileFromTab: (tabIndex: number, fileName: string) => Promise<void>;
  handleCreateAndAddFileToTab: (tabIndex: number) => void;
  handleAddTab: () => void;
  getFileLabel: (fileName: string) => string;
  handleFileLabelChange: (fileName: string, label: string) => void;
}

/**
 * ファイル操作フック（追加、削除、作成、ラベル管理）
 *
 * 責務:
 * - タブへのファイル追加・削除
 * - 新規ファイル作成
 * - 新規タブ追加
 * - ファイルラベルの取得・変更
 */
export function useFileOperations({
  editedSettings,
  setEditedSettings,
  pendingFileOperations,
  setPendingFileOperations,
  setExpandedTabs,
  showAlert,
  showConfirm,
}: UseFileOperationsProps): UseFileOperationsReturn {
  // タブにファイルを追加
  const handleAddFileToTab = useCallback(
    (tabIndex: number, fileName: string) => {
      const tabs = editedSettings.dataFileTabs || [];
      if (tabIndex < 0 || tabIndex >= tabs.length) return;

      const tab = tabs[tabIndex];

      const validation = TabValidator.canAddFileToTab(fileName, tab);
      if (!validation.valid) {
        showAlert(validation.reason || 'ファイルを追加できません。', 'warning');
        return;
      }

      const updatedTabs = [...tabs];
      updatedTabs[tabIndex] = {
        ...tab,
        files: [...tab.files, fileName],
      };

      const labels = { ...(editedSettings.dataFileLabels || {}) };
      const currentLabel = labels[fileName];

      if (!currentLabel || currentLabel.trim() === '' || currentLabel === fileName) {
        const usedLabels = new Set<string>(
          Object.values(labels).filter((l) => l && l.trim() !== '')
        );
        const baseLabel = FileNameGenerator.getDefaultFileLabel(fileName, tab.name, tabs);
        labels[fileName] = FileNameGenerator.generateUniqueLabel(baseLabel, usedLabels);
      }

      setEditedSettings((prev) => ({
        ...prev,
        dataFileTabs: updatedTabs,
        dataFileLabels: labels,
      }));
    },
    [editedSettings.dataFileTabs, editedSettings.dataFileLabels, setEditedSettings, showAlert]
  );

  // タブからファイルを削除
  const handleRemoveFileFromTab = useCallback(
    async (tabIndex: number, fileName: string) => {
      const tabs = editedSettings.dataFileTabs || [];
      if (tabIndex < 0 || tabIndex >= tabs.length) return;

      const tab = tabs[tabIndex];

      const validation = TabValidator.canRemoveFileFromTab(fileName, tabIndex, tabs);
      if (!validation.valid) {
        showAlert(validation.reason || 'ファイルを削除できません。', 'warning');
        return;
      }

      const newFiles = tab.files.filter((f) => f !== fileName);
      const updatedTabs = [...tabs];
      updatedTabs[tabIndex] = {
        ...tab,
        files: newFiles,
      };

      const deletionType = TabStateCalculator.getFileDeletionType(
        fileName,
        pendingFileOperations.filesToCreate,
        updatedTabs
      );

      const message =
        deletionType === 'removeFromTab'
          ? `${fileName} をこのタブから削除しますか？\n\n他のタブでも使用されているため、ファイル自体は削除されません。`
          : `${fileName} を削除しますか？\n\n⚠️ 保存ボタンを押すと、データファイルはディスクから完全に削除されます。`;

      const confirmed = await showConfirm(message, {
        title: deletionType === 'removeFromTab' ? 'タブから削除' : 'データファイル削除の確認',
        confirmText: '削除',
        danger: deletionType !== 'removeFromTab',
      });

      if (!confirmed) {
        return;
      }

      setEditedSettings((prev) => ({
        ...prev,
        dataFileTabs: updatedTabs,
      }));

      setPendingFileOperations((prev) => {
        if (deletionType === 'cancelCreation') {
          return { ...prev, filesToCreate: prev.filesToCreate.filter((f) => f !== fileName) };
        }
        if (deletionType === 'scheduleDelete') {
          return { ...prev, filesToDelete: [...prev.filesToDelete, fileName] };
        }
        return prev;
      });
    },
    [
      editedSettings.dataFileTabs,
      pendingFileOperations.filesToCreate,
      setEditedSettings,
      setPendingFileOperations,
      showAlert,
      showConfirm,
    ]
  );

  const getNextFileName = useCallback((): string => {
    const existingFiles = editedSettings.dataFileTabs?.flatMap((tab) => tab.files) || [];
    return FileNameGenerator.getNextAvailableFileName(
      existingFiles,
      pendingFileOperations.filesToCreate
    );
  }, [editedSettings.dataFileTabs, pendingFileOperations.filesToCreate]);

  const handleCreateAndAddFileToTab = useCallback(
    (tabIndex: number) => {
      const fileName = getNextFileName();
      setPendingFileOperations((prev) => ({
        ...prev,
        filesToCreate: [...prev.filesToCreate, fileName],
      }));
      handleAddFileToTab(tabIndex, fileName);
    },
    [getNextFileName, setPendingFileOperations, handleAddFileToTab]
  );

  const handleAddTab = useCallback(() => {
    const fileName = getNextFileName();

    setPendingFileOperations((prev) => ({
      ...prev,
      filesToCreate: [...prev.filesToCreate, fileName],
    }));

    const newTab: DataFileTab = {
      files: [fileName],
      name: FileNameGenerator.getDefaultTabName(fileName),
    };
    const updatedTabs = [...(editedSettings.dataFileTabs || []), newTab];

    setEditedSettings((prev) => ({
      ...prev,
      dataFileTabs: updatedTabs,
    }));

    setExpandedTabs((prev) => new Set([...prev, updatedTabs.length - 1]));
  }, [
    editedSettings.dataFileTabs,
    getNextFileName,
    setPendingFileOperations,
    setEditedSettings,
    setExpandedTabs,
  ]);

  const getFileLabel = useCallback(
    (fileName: string): string => {
      const labels = editedSettings.dataFileLabels || {};
      const label = labels[fileName];

      if (!label || label === fileName) {
        const tabs = editedSettings.dataFileTabs || [];
        const linkedTab = tabs.find((tab) => tab.files.includes(fileName));
        return FileNameGenerator.getDefaultFileLabel(fileName, linkedTab?.name, tabs);
      }

      return label;
    },
    [editedSettings.dataFileLabels, editedSettings.dataFileTabs]
  );

  const handleFileLabelChange = useCallback(
    (fileName: string, label: string) => {
      const labels = { ...(editedSettings.dataFileLabels || {}) };
      labels[fileName] = label;

      setEditedSettings((prev) => ({
        ...prev,
        dataFileLabels: labels,
      }));
    },
    [editedSettings.dataFileLabels, setEditedSettings]
  );

  return {
    handleAddFileToTab,
    handleRemoveFileFromTab,
    handleCreateAndAddFileToTab,
    handleAddTab,
    getFileLabel,
    handleFileLabelChange,
  };
}
