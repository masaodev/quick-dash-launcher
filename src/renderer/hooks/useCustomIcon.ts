import { useState } from 'react';

import { logError } from '../utils/debug';

/**
 * カスタムアイコン管理フック
 *
 * カスタムアイコンの選択、プレビュー、削除を管理します。
 */
export function useCustomIcon() {
  // カスタムアイコンのプレビュー（index -> base64データURL）
  const [customIconPreviews, setCustomIconPreviews] = useState<{ [index: number]: string }>({});

  // FilePickerDialog の状態管理
  const [filePickerState, setFilePickerState] = useState<{
    isOpen: boolean;
    itemIndex: number | null;
  }>({
    isOpen: false,
    itemIndex: null,
  });

  /**
   * カスタムアイコン選択ダイアログを開く
   */
  const openCustomIconPicker = (index: number) => {
    setFilePickerState({
      isOpen: true,
      itemIndex: index,
    });
  };

  /**
   * カスタムアイコンファイルが選択されたときの処理
   */
  const handleCustomIconFileSelected = async (
    filePath: string,
    itemPath: string,
    onIconUpdated: (index: number, customIconFileName: string) => void
  ) => {
    if (filePickerState.itemIndex === null) return;

    try {
      const index = filePickerState.itemIndex;
      const customIconFileName = await window.electronAPI.saveCustomIcon(filePath, itemPath);

      // アイテムのcustomIconを更新（親コンポーネントのコールバック）
      onIconUpdated(index, customIconFileName);

      // プレビュー用にアイコンを取得
      const iconData = await window.electronAPI.getCustomIcon(customIconFileName);
      if (iconData) {
        setCustomIconPreviews((prev) => ({ ...prev, [index]: iconData }));
      }
    } catch (error) {
      logError('カスタムアイコン選択エラー:', error);
      alert('カスタムアイコンの選択に失敗しました: ' + error);
    }
  };

  /**
   * カスタムアイコンを削除
   */
  const deleteCustomIcon = async (
    index: number,
    customIconFileName: string,
    onIconDeleted: (index: number) => void
  ) => {
    try {
      await window.electronAPI.deleteCustomIcon(customIconFileName);

      // アイテムのcustomIconを削除（親コンポーネントのコールバック）
      onIconDeleted(index);

      // プレビューも削除
      setCustomIconPreviews((prev) => {
        const newPreviews = { ...prev };
        delete newPreviews[index];
        return newPreviews;
      });
    } catch (error) {
      logError('カスタムアイコン削除エラー:', error);
      alert('カスタムアイコンの削除に失敗しました: ' + error);
    }
  };

  /**
   * 編集モードでカスタムアイコンのプレビューを読み込み
   */
  const loadCustomIconPreview = async (index: number, customIconFileName: string) => {
    try {
      const iconData = await window.electronAPI.getCustomIcon(customIconFileName);
      if (iconData) {
        setCustomIconPreviews((prev) => ({ ...prev, [index]: iconData }));
      }
    } catch (error) {
      logError('カスタムアイコンプレビュー読み込みエラー:', error);
    }
  };

  /**
   * FilePickerDialogを閉じる
   */
  const closeCustomIconPicker = () => {
    setFilePickerState({ isOpen: false, itemIndex: null });
  };

  /**
   * カスタムアイコンプレビューをクリア
   */
  const clearCustomIconPreviews = () => {
    setCustomIconPreviews({});
  };

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
