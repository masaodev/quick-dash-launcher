import { useTranslation } from 'react-i18next';

import { ipcErrorMessage } from '../utils/ipcError';

interface UnusedClipboardDataCleanupOptions {
  /** 未保存の変更があるか（保存前のアイテムが指す中身を、使われていないと見なさないよう先に保存してもらう） */
  hasUnsavedChanges: boolean;
  openConfirmDialog: (
    options: { message: string; confirmText: string; danger: boolean },
    action: () => void
  ) => void;
  toast: {
    showSuccess: (message: string) => void;
    showInfo: (message: string) => void;
    showError: (message: string) => void;
  };
}

/**
 * 「整理 ▼」の「使われていないクリップボードの中身を削除」
 *
 * どのアイテムからも使われていない実データを数え、確かめてから消す。アイテムの一覧は変えないので、
 * 「保存」を待たずにすぐ消す
 */
export function useUnusedClipboardDataCleanup({
  hasUnsavedChanges,
  openConfirmDialog,
  toast,
}: UnusedClipboardDataCleanupOptions): () => Promise<void> {
  const { t } = useTranslation();

  const deleteUnused = async () => {
    try {
      const deleted = await window.electronAPI.clipboardAPI.deleteUnusedData();
      toast.showSuccess(t('itemManager.cleanedClipboardData', { count: deleted }));
    } catch (error) {
      toast.showError(ipcErrorMessage(error));
    }
  };

  return async () => {
    if (hasUnsavedChanges) {
      toast.showInfo(t('itemManager.cleanClipboardDataNeedsSave'));
      return;
    }
    let count: number;
    try {
      count = await window.electronAPI.clipboardAPI.countUnusedData();
    } catch (error) {
      toast.showError(ipcErrorMessage(error));
      return;
    }
    if (count === 0) {
      toast.showInfo(t('itemManager.noUnusedClipboardData'));
      return;
    }
    openConfirmDialog(
      {
        message: t('itemManager.cleanClipboardDataConfirm', { count }),
        confirmText: t('itemManager.deleteButton'),
        danger: true,
      },
      () => void deleteUnused()
    );
  };
}
