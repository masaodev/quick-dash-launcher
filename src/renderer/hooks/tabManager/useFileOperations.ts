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

      // バリデーション: ファイル追加可能かチェック
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

      // ファイルにデフォルトラベルを設定
      const labels = { ...(editedSettings.dataFileLabels || {}) };
      const currentLabel = labels[fileName];

      // ラベルが未設定の場合、デフォルトラベルを生成
      if (!currentLabel || currentLabel.trim() === '' || currentLabel === fileName) {
        const usedLabels = new Set<string>(
          Object.values(labels).filter((l) => l && l.trim() !== '')
        );
        const baseLabel = FileNameGenerator.getDefaultFileLabel(fileName, tab.name, tabs);
        const newLabel = FileNameGenerator.generateUniqueLabel(baseLabel, usedLabels);

        labels[fileName] = newLabel;

        // 設定を更新（状態のみ）
        setEditedSettings((prev) => ({
          ...prev,
          dataFileTabs: updatedTabs,
          dataFileLabels: labels,
        }));
      } else {
        // ラベルが既に設定されている場合は、タブ設定のみ更新
        setEditedSettings((prev) => ({
          ...prev,
          dataFileTabs: updatedTabs,
        }));
      }
    },
    [editedSettings.dataFileTabs, editedSettings.dataFileLabels, setEditedSettings, showAlert]
  );

  // タブからファイルを削除
  const handleRemoveFileFromTab = useCallback(
    async (tabIndex: number, fileName: string) => {
      const tabs = editedSettings.dataFileTabs || [];
      if (tabIndex < 0 || tabIndex >= tabs.length) return;

      const tab = tabs[tabIndex];

      // バリデーション: ファイル削除可能かチェック
      const validation = TabValidator.canRemoveFileFromTab(fileName, tabIndex, tabs);
      if (!validation.valid) {
        showAlert(validation.reason || 'ファイルを削除できません。', 'warning');
        return;
      }

      // タブからファイルを削除した後の状態を計算
      const newFiles = tab.files.filter((f) => f !== fileName);
      const updatedTabs = [...tabs];
      updatedTabs[tabIndex] = {
        ...tab,
        files: newFiles,
      };

      // 削除タイプを判定
      const deletionType = TabStateCalculator.getFileDeletionType(
        fileName,
        pendingFileOperations.filesToCreate,
        updatedTabs
      );

      // 確認メッセージを構築
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

      try {
        // タブからファイルを削除（状態更新のみ）
        setEditedSettings((prev) => ({
          ...prev,
          dataFileTabs: updatedTabs,
        }));

        // ファイル操作を更新
        setPendingFileOperations((prev) => {
          if (deletionType === 'cancelCreation') {
            // 作成予定リストから削除
            return {
              ...prev,
              filesToCreate: prev.filesToCreate.filter((f) => f !== fileName),
            };
          } else if (deletionType === 'scheduleDelete') {
            // 削除予定リストに追加
            return {
              ...prev,
              filesToDelete: [...prev.filesToDelete, fileName],
            };
          }
          // removeFromTab の場合は何もしない
          return prev;
        });
      } catch (error) {
        console.error('ファイルの削除に失敗しました:', error);
        showAlert('ファイルの削除に失敗しました。', 'error');
      }
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

  // 新規ファイルを作成してタブに追加
  const handleCreateAndAddFileToTab = useCallback(
    (tabIndex: number) => {
      const existingFiles = [
        ...(editedSettings.dataFileTabs?.flatMap((tab) => tab.files) || []),
        ...pendingFileOperations.filesToCreate,
      ];
      const fileName = FileNameGenerator.getNextAvailableFileName(
        existingFiles,
        pendingFileOperations.filesToCreate
      );

      try {
        // ファイルを作成予定リストに追加
        setPendingFileOperations((prev) => ({
          ...prev,
          filesToCreate: [...prev.filesToCreate, fileName],
        }));

        // タブにファイルを追加
        handleAddFileToTab(tabIndex, fileName);
      } catch (error) {
        console.error('ファイルの作成に失敗しました:', error);
        showAlert('ファイルの作成に失敗しました。', 'error');
      }
    },
    [
      editedSettings.dataFileTabs,
      pendingFileOperations.filesToCreate,
      setPendingFileOperations,
      handleAddFileToTab,
      showAlert,
    ]
  );

  // 新規タブを追加
  const handleAddTab = useCallback(() => {
    const existingFiles = [
      ...(editedSettings.dataFileTabs?.flatMap((tab) => tab.files) || []),
      ...pendingFileOperations.filesToCreate,
    ];
    const fileName = FileNameGenerator.getNextAvailableFileName(
      existingFiles,
      pendingFileOperations.filesToCreate
    );

    try {
      // ファイルを作成予定リストに追加
      setPendingFileOperations((prev) => ({
        ...prev,
        filesToCreate: [...prev.filesToCreate, fileName],
      }));

      // 新しいタブを追加（状態更新のみ）
      const newTab: DataFileTab = {
        files: [fileName],
        name: FileNameGenerator.getDefaultTabName(fileName),
      };
      const updatedTabs = [...(editedSettings.dataFileTabs || []), newTab];

      setEditedSettings((prev) => ({
        ...prev,
        dataFileTabs: updatedTabs,
      }));

      // 新規タブを展開状態にする
      setExpandedTabs((prev) => new Set([...prev, updatedTabs.length - 1]));
    } catch (error) {
      console.error('タブの追加に失敗しました:', error);
      showAlert('タブの追加に失敗しました。', 'error');
    }
  }, [
    editedSettings.dataFileTabs,
    pendingFileOperations.filesToCreate,
    setPendingFileOperations,
    setEditedSettings,
    setExpandedTabs,
    showAlert,
  ]);

  // データファイル名を取得（表示用）
  const getFileLabel = useCallback(
    (fileName: string): string => {
      const labels = editedSettings.dataFileLabels || {};
      const label = labels[fileName];

      // ラベルが未設定またはファイル名と同じ場合、デフォルトラベルを返す
      if (!label || label === fileName) {
        const tabs = editedSettings.dataFileTabs || [];
        const linkedTab = tabs.find((tab) => tab.files.includes(fileName));
        return FileNameGenerator.getDefaultFileLabel(fileName, linkedTab?.name, tabs);
      }

      return label;
    },
    [editedSettings.dataFileLabels, editedSettings.dataFileTabs]
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

  return {
    handleAddFileToTab,
    handleRemoveFileFromTab,
    handleCreateAndAddFileToTab,
    handleAddTab,
    getFileLabel,
    handleFileLabelChange,
  };
}
