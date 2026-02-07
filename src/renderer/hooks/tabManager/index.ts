import { useCallback, Dispatch, SetStateAction } from 'react';
import { AppSettings } from '@common/types';

import { HandleSettingChange } from '../useSettingsManager';
import { FileNameGenerator } from '../../utils/tabManager';

import { useTabState } from './useTabState';
import { useTabOperations } from './useTabOperations';
import { useFileOperations } from './useFileOperations';
import { useTabPersistence } from './useTabPersistence';

interface UseTabManagerProps {
  editedSettings: AppSettings;
  setEditedSettings: Dispatch<SetStateAction<AppSettings>>;
  handleSettingChange: HandleSettingChange;
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
  showToast?: (message: string) => void;
}

interface UseTabManagerReturn {
  fileModalTabIndex: number | null;
  getDefaultTabName: (fileName: string) => string;
  getDefaultFileLabel: (fileName: string, tabName?: string) => string;
  handleMoveTabUp: (tabIndex: number) => void;
  handleMoveTabDown: (tabIndex: number) => void;
  handleTabNameChangeByIndex: (tabIndex: number, tabName: string) => void;
  handleDeleteTab: (tabIndex: number) => Promise<void>;
  handleAddFileToTab: (tabIndex: number, fileName: string) => void;
  handleRemoveFileFromTab: (tabIndex: number, fileName: string) => Promise<void>;
  handleCreateAndAddFileToTab: (tabIndex: number) => void;
  handleAddTab: () => void;
  openFileModal: (tabIndex: number) => void;
  closeFileModal: () => void;
  getFileLabel: (fileName: string) => string;
  handleFileLabelChange: (fileName: string, label: string) => void;
  hasUnsavedChanges: boolean;
  handleSaveTabChanges: () => Promise<void>;
  handleCancelTabChanges: (skipConfirmation?: boolean) => Promise<void>;
  toggleTabExpand: (tabIndex: number) => void;
  isTabExpanded: (tabIndex: number) => boolean;
}

/**
 * タブ管理の統合フック
 *
 * 責務:
 * - 各サブフックの統合
 * - 既存インターフェース（useTabManager）との互換性維持
 * - UI制御（アコーディオン、モーダル）
 */
export function useTabManager({
  editedSettings,
  setEditedSettings,
  handleSettingChange,
  showAlert,
  showConfirm,
  showToast,
}: UseTabManagerProps): UseTabManagerReturn {
  // 状態管理
  const {
    expandedTabs,
    setExpandedTabs,
    savedTabsState,
    setSavedTabsState,
    pendingFileOperations,
    setPendingFileOperations,
    fileModalTabIndex,
    setFileModalTabIndex,
    hasUnsavedChanges,
  } = useTabState({ editedSettings });

  // タブ操作
  const { handleMoveTabUp, handleMoveTabDown, handleTabNameChange, handleDeleteTab } =
    useTabOperations({
      editedSettings,
      setEditedSettings,
      pendingFileOperations,
      setPendingFileOperations,
      showAlert,
      showConfirm,
    });

  // ファイル操作
  const {
    handleAddFileToTab,
    handleRemoveFileFromTab,
    handleCreateAndAddFileToTab,
    handleAddTab,
    getFileLabel,
    handleFileLabelChange,
  } = useFileOperations({
    editedSettings,
    setEditedSettings,
    pendingFileOperations,
    setPendingFileOperations,
    setExpandedTabs,
    showAlert,
    showConfirm,
  });

  // 保存・キャンセル
  const { handleSave, handleCancel } = useTabPersistence({
    editedSettings,
    setEditedSettings,
    pendingFileOperations,
    setPendingFileOperations,
    savedTabsState,
    setSavedTabsState,
    handleSettingChange,
    showAlert,
    showConfirm,
    showToast,
  });

  // ユーティリティ関数のラッパー
  const getDefaultTabName = useCallback((fileName: string) => {
    return FileNameGenerator.getDefaultTabName(fileName);
  }, []);

  const getDefaultFileLabel = useCallback(
    (fileName: string, tabName?: string) => {
      const tabs = editedSettings.dataFileTabs || [];
      return FileNameGenerator.getDefaultFileLabel(fileName, tabName, tabs);
    },
    [editedSettings.dataFileTabs]
  );

  // アコーディオン制御
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

  const isTabExpanded = useCallback(
    (tabIndex: number) => expandedTabs.has(tabIndex),
    [expandedTabs]
  );

  // モーダル制御
  const openFileModal = useCallback((tabIndex: number) => {
    setFileModalTabIndex(tabIndex);
  }, []);

  const closeFileModal = useCallback(() => {
    setFileModalTabIndex(null);
  }, []);

  return {
    fileModalTabIndex,
    getDefaultTabName,
    getDefaultFileLabel,
    handleMoveTabUp,
    handleMoveTabDown,
    handleTabNameChangeByIndex: handleTabNameChange,
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
    handleSaveTabChanges: handleSave,
    handleCancelTabChanges: handleCancel,
    toggleTabExpand,
    isTabExpanded,
  };
}
