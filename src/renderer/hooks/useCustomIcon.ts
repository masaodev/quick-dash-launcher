import i18next from 'i18next';
import { useState, useCallback } from 'react';

import { logError } from '../utils/debug';

import { useToast } from './useToast';

/**
 * カスタムアイコンの選択、プレビュー、削除を管理するフック
 */
export function useCustomIcon() {
  const { showError } = useToast();
  const [customIconPreviews, setCustomIconPreviews] = useState<{ [index: number]: string }>({});
  const [filePickerState, setFilePickerState] = useState<{
    isOpen: boolean;
    itemIndex: number | null;
  }>({
    isOpen: false,
    itemIndex: null,
  });

  const openCustomIconPicker = useCallback((index: number) => {
    setFilePickerState({
      isOpen: true,
      itemIndex: index,
    });
  }, []);

  const handleCustomIconFileSelected = useCallback(
    async (
      filePath: string,
      itemPath: string,
      onIconUpdated: (index: number, customIconFileName: string) => void
    ) => {
      if (filePickerState.itemIndex === null) return;

      try {
        const index = filePickerState.itemIndex;
        const customIconFileName = await window.electronAPI.saveCustomIcon(filePath, itemPath);
        onIconUpdated(index, customIconFileName);

        const iconData = await window.electronAPI.getCustomIcon(customIconFileName);
        if (iconData) {
          setCustomIconPreviews((prev) => ({ ...prev, [index]: iconData }));
        }
      } catch (error) {
        logError('カスタムアイコン選択エラー:', error);
        showError(i18next.t('register.errors.customIconSelectFailed', { error: String(error) }));
      }
    },
    [filePickerState.itemIndex, showError]
  );

  const deleteCustomIcon = useCallback(
    async (index: number, customIconFileName: string, onIconDeleted: (index: number) => void) => {
      try {
        await window.electronAPI.deleteCustomIcon(customIconFileName);
        onIconDeleted(index);

        setCustomIconPreviews((prev) => {
          const newPreviews = { ...prev };
          delete newPreviews[index];
          return newPreviews;
        });
      } catch (error) {
        logError('カスタムアイコン削除エラー:', error);
        showError(i18next.t('register.errors.customIconDeleteFailed', { error: String(error) }));
      }
    },
    [showError]
  );

  const loadCustomIconPreview = useCallback(async (index: number, customIconFileName: string) => {
    try {
      const iconData = await window.electronAPI.getCustomIcon(customIconFileName);
      if (iconData) {
        setCustomIconPreviews((prev) => ({ ...prev, [index]: iconData }));
      }
    } catch (error) {
      logError('カスタムアイコンプレビュー読み込みエラー:', error);
    }
  }, []);

  const closeCustomIconPicker = useCallback(() => {
    setFilePickerState({ isOpen: false, itemIndex: null });
  }, []);

  const clearCustomIconPreviews = useCallback(() => {
    setCustomIconPreviews({});
  }, []);

  return {
    customIconPreviews,
    filePickerState,
    openCustomIconPicker,
    closeCustomIconPicker,
    handleCustomIconFileSelected,
    deleteCustomIcon,
    loadCustomIconPreview,
    clearCustomIconPreviews,
  };
}
