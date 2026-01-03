import { useState, useCallback, useEffect, Dispatch, SetStateAction } from 'react';
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

  // アコーディオン展開状態（タブインデックスのセット）
  const [expandedTabs, setExpandedTabs] = useState<Set<number>>(new Set());

  // 保存済み状態（キャンセル時に復元するため）
  const [savedTabsState, setSavedTabsState] = useState<{
    dataFileTabs: DataFileTab[];
    dataFileLabels: Record<string, string>;
  } | null>(null);

  // 保留中のファイル操作
  const [pendingFileOperations, setPendingFileOperations] = useState<{
    filesToCreate: string[];
    filesToDelete: string[];
  }>({
    filesToCreate: [],
    filesToDelete: [],
  });

  // 未保存変更フラグ
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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

  // デフォルトのファイルラベルを生成（紐づくタブ名 + 用データファイル）
  const getDefaultFileLabel = useCallback(
    (fileName: string, tabName?: string): string => {
      // タブ名が指定されていない場合は、ファイルが紐づいている最初のタブ名を取得
      if (!tabName) {
        const tabs = editedSettings.dataFileTabs || [];
        const linkedTab = tabs.find((tab) => tab.files.includes(fileName));
        tabName = linkedTab ? linkedTab.name : getDefaultTabName(fileName);
      }
      return `${tabName}用データファイル`;
    },
    [editedSettings.dataFileTabs, getDefaultTabName]
  );

  // 次に使用可能なファイル名を生成（data2.txt, data3.txt, ...）
  const getNextAvailableFileName = useCallback((): string => {
    const allFiles = [...dataFiles, ...pendingFileOperations.filesToCreate];
    const existingNumbers = allFiles
      .map((file) => {
        if (file === 'data.txt') return 1;
        const match = file.match(/^data(\d+)\.txt$/i);
        return match ? parseInt(match[1]) : null;
      })
      .filter((n): n is number => n !== null);

    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 2;
    return `data${nextNumber}.txt`;
  }, [dataFiles, pendingFileOperations.filesToCreate]);

  // 初回表示時に保存済み状態を記録
  useEffect(() => {
    setSavedTabsState({
      dataFileTabs: editedSettings.dataFileTabs || [],
      dataFileLabels: editedSettings.dataFileLabels || {},
    });
  }, []);

  // 変更検知（editedSettings変更時）
  useEffect(() => {
    if (!savedTabsState) return;

    const hasTabsChange =
      JSON.stringify(savedTabsState.dataFileTabs) !==
      JSON.stringify(editedSettings.dataFileTabs || []);
    const hasLabelsChange =
      JSON.stringify(savedTabsState.dataFileLabels) !==
      JSON.stringify(editedSettings.dataFileLabels || {});
    const hasPendingOps =
      pendingFileOperations.filesToCreate.length > 0 ||
      pendingFileOperations.filesToDelete.length > 0;

    setHasUnsavedChanges(hasTabsChange || hasLabelsChange || hasPendingOps);
  }, [
    editedSettings.dataFileTabs,
    editedSettings.dataFileLabels,
    savedTabsState,
    pendingFileOperations,
  ]);

  // タブを上に移動（インデックスベース）
  const handleMoveTabUp = useCallback(
    (tabIndex: number) => {
      const tabs = editedSettings.dataFileTabs || [];
      if (tabIndex <= 0) return;

      const newTabs = [...tabs];
      [newTabs[tabIndex - 1], newTabs[tabIndex]] = [newTabs[tabIndex], newTabs[tabIndex - 1]];

      setEditedSettings((prev) => ({
        ...prev,
        dataFileTabs: newTabs,
      }));
    },
    [editedSettings.dataFileTabs, setEditedSettings]
  );

  // タブを下に移動（インデックスベース）
  const handleMoveTabDown = useCallback(
    (tabIndex: number) => {
      const tabs = editedSettings.dataFileTabs || [];
      if (tabIndex < 0 || tabIndex >= tabs.length - 1) return;

      const newTabs = [...tabs];
      [newTabs[tabIndex], newTabs[tabIndex + 1]] = [newTabs[tabIndex + 1], newTabs[tabIndex]];

      setEditedSettings((prev) => ({
        ...prev,
        dataFileTabs: newTabs,
      }));
    },
    [editedSettings.dataFileTabs, setEditedSettings]
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
        `タブ「${tab.name}」を削除しますか？\n\n⚠️ このタブに含まれるデータファイル（${tab.files.join(', ')}）は\nディスクから完全に削除されます。この操作は取り消せません。`,
        {
          title: 'タブ削除の確認',
          confirmText: '完全に削除',
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

        // タブに含まれる全ファイルを削除予定リストに追加
        setPendingFileOperations((prev) => {
          const newFilesToDelete = [...prev.filesToDelete];
          for (const fileName of tab.files) {
            // 作成予定リストにあるファイルの場合は、作成予定リストから削除するだけ
            if (prev.filesToCreate.includes(fileName)) {
              continue;
            }
            // 既存ファイルの場合は削除予定リストに追加
            if (!newFilesToDelete.includes(fileName)) {
              newFilesToDelete.push(fileName);
            }
          }
          return {
            filesToCreate: prev.filesToCreate.filter((f) => !tab.files.includes(f)),
            filesToDelete: newFilesToDelete,
          };
        });
      } catch (error) {
        console.error('タブの削除に失敗しました:', error);
        showAlert('タブの削除に失敗しました。', 'error');
      }
    },
    [editedSettings.dataFileTabs, setEditedSettings, showAlert, showConfirm]
  );

  // タブにファイルを追加
  const handleAddFileToTab = useCallback(
    (tabIndex: number, fileName: string) => {
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

      // ファイルにデフォルトラベルを設定
      const labels = { ...(editedSettings.dataFileLabels || {}) };
      const currentLabel = labels[fileName];

      // ラベルが未設定の場合、デフォルトラベルを生成
      if (!currentLabel || currentLabel.trim() === '' || currentLabel === fileName) {
        const usedLabels = new Set<string>(
          Object.values(labels).filter((l) => l && l.trim() !== '')
        );
        let newLabel = getDefaultFileLabel(fileName, tab.name);

        // 同じラベルが既に存在する場合は番号を付ける
        if (usedLabels.has(newLabel)) {
          let counter = 2;
          while (usedLabels.has(`${newLabel}${counter}`)) {
            counter++;
          }
          newLabel = `${newLabel}${counter}`;
        }

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
    [
      editedSettings.dataFileTabs,
      editedSettings.dataFileLabels,
      getDefaultFileLabel,
      setEditedSettings,
      showAlert,
    ]
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
        `${fileName} を削除しますか？\n\n⚠️ データファイルはディスクから完全に削除されます。\nこの操作は取り消せません。`,
        {
          title: 'データファイル削除の確認',
          confirmText: '完全に削除',
          danger: true,
        }
      );

      if (!confirmed) {
        return;
      }

      try {
        // タブからファイルを削除（状態更新のみ）
        const newFiles = tab.files.filter((f) => f !== fileName);

        const updatedTabs = [...tabs];
        updatedTabs[tabIndex] = {
          ...tab,
          files: newFiles,
        };

        setEditedSettings((prev) => ({
          ...prev,
          dataFileTabs: updatedTabs,
        }));

        // ファイルを削除予定リストに追加
        setPendingFileOperations((prev) => {
          // 作成予定リストにあるファイルの場合は、作成予定リストから削除するだけ
          if (prev.filesToCreate.includes(fileName)) {
            return {
              ...prev,
              filesToCreate: prev.filesToCreate.filter((f) => f !== fileName),
            };
          }
          // 既存ファイルの場合は削除予定リストに追加
          return {
            ...prev,
            filesToDelete: [...prev.filesToDelete, fileName],
          };
        });
      } catch (error) {
        console.error('ファイルの削除に失敗しました:', error);
        showAlert('ファイルの削除に失敗しました。', 'error');
      }
    },
    [editedSettings.dataFileTabs, setEditedSettings, showAlert, showConfirm]
  );

  // 新規ファイルを作成してタブに追加
  const handleCreateAndAddFileToTab = useCallback(
    (tabIndex: number) => {
      const fileName = getNextAvailableFileName();

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
    [getNextAvailableFileName, handleAddFileToTab, showAlert]
  );

  // 新規タブを追加
  const handleAddTab = useCallback(() => {
    const fileName = getNextAvailableFileName();

    try {
      // ファイルを作成予定リストに追加
      setPendingFileOperations((prev) => ({
        ...prev,
        filesToCreate: [...prev.filesToCreate, fileName],
      }));

      // 新しいタブを追加（状態更新のみ）
      const newTab: DataFileTab = {
        files: [fileName],
        name: getDefaultTabName(fileName),
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
    getNextAvailableFileName,
    editedSettings.dataFileTabs,
    getDefaultTabName,
    setEditedSettings,
    showAlert,
  ]);

  // タブの展開/折りたたみをトグル
  const toggleTabExpand = useCallback((tabIndex: number) => {
    setExpandedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(tabIndex)) {
        next.delete(tabIndex);
      } else {
        next.add(tabIndex);
      }
      return next;
    });
  }, []);

  // タブが展開されているかどうか
  const isTabExpanded = useCallback(
    (tabIndex: number) => expandedTabs.has(tabIndex),
    [expandedTabs]
  );

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
      const label = labels[fileName];

      // ラベルが未設定またはファイル名と同じ場合、デフォルトラベルを返す
      if (!label || label === fileName) {
        const tabs = editedSettings.dataFileTabs || [];
        const linkedTab = tabs.find((tab) => tab.files.includes(fileName));
        return getDefaultFileLabel(fileName, linkedTab?.name);
      }

      return label;
    },
    [editedSettings.dataFileLabels, editedSettings.dataFileTabs, getDefaultFileLabel]
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

  // タブ管理の保存処理
  const handleSaveTabChanges = useCallback(async () => {
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
            labels[fileName] = getDefaultFileLabel(fileName, tab.name);
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
      console.error('タブ設定の保存に失敗しました:', error);
      showAlert('タブ設定の保存に失敗しました。', 'error');
    }
  }, [
    editedSettings,
    pendingFileOperations,
    handleSettingChange,
    showAlert,
    getDefaultFileLabel,
  ]);

  // タブ管理のキャンセル処理
  const handleCancelTabChanges = useCallback(async () => {
    const confirmed = await showConfirm('未保存の変更を破棄しますか？', {
      title: 'タブ管理の変更を破棄',
      confirmText: '破棄',
      danger: true,
    });

    if (!confirmed) return;

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

    showAlert('変更を破棄しました。', 'info');
  }, [savedTabsState, setEditedSettings, showConfirm, showAlert]);

  return {
    fileModalTabIndex,
    getDefaultTabName,
    getDefaultFileLabel,
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
    hasUnsavedChanges,
    handleSaveTabChanges,
    handleCancelTabChanges,
    toggleTabExpand,
    isTabExpanded,
  };
}
