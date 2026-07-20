import { useCallback } from 'react';
import { LauncherItem } from '@common/types';
import { PathUtils } from '@common/utils/pathUtils';

import { logWarn, logError } from '../utils/debug';

import { useToast } from './useToast';

export function useItemActions() {
  const { showSuccess, showError, showWarning } = useToast();

  const copyToClipboard = useCallback(
    async (text: string, label: string): Promise<void> => {
      try {
        await window.electronAPI.copyToClipboard(text);
        logWarn(`${label}をコピーしました: ${text}`);
        showSuccess(`${label}をコピーしました`);
      } catch (err) {
        logError(`${label}のコピーに失敗しました:`, err);
        showError(`${label}のコピーに失敗しました`);
      }
    },
    [showSuccess, showError]
  );

  const handleCopyPath = useCallback(
    async (item: LauncherItem): Promise<void> => {
      await copyToClipboard(PathUtils.getFullPath(item), 'パス');
    },
    [copyToClipboard]
  );

  const handleCopyParentPath = useCallback(
    async (item: LauncherItem): Promise<void> => {
      if (item.type === 'url' || item.type === 'customUri') {
        showWarning('URLおよびカスタムURIには親フォルダーがありません');
        return;
      }

      const parentPath = PathUtils.getParentPath(item.path);
      if (!parentPath) {
        showWarning('親フォルダーのパスを取得できませんでした');
        return;
      }

      await copyToClipboard(parentPath, '親フォルダーのパス');
    },
    [copyToClipboard, showWarning]
  );

  const handleCopyShortcutPath = useCallback(
    async (item: LauncherItem): Promise<void> => {
      if (!item.originalPath) {
        showWarning('ショートカットのパスが見つかりません');
        return;
      }

      await copyToClipboard(item.originalPath, 'ショートカットのパス');
    },
    [copyToClipboard, showWarning]
  );

  const handleCopyShortcutParentPath = useCallback(
    async (item: LauncherItem): Promise<void> => {
      if (!item.originalPath) {
        showWarning('ショートカットのパスが見つかりません');
        return;
      }

      const parentPath = PathUtils.getParentPath(item.originalPath);
      if (!parentPath) {
        showWarning('ショートカットの親フォルダーのパスを取得できませんでした');
        return;
      }

      await copyToClipboard(parentPath, 'ショートカットの親フォルダーのパス');
    },
    [copyToClipboard, showWarning]
  );

  const handleOpenParentFolder = useCallback(
    async (item: LauncherItem): Promise<void> => {
      try {
        await window.electronAPI.openParentFolder(item);
      } catch (err) {
        logError('親フォルダーを開くのに失敗しました:', err);
        showError('親フォルダーを開くのに失敗しました');
      }
    },
    [showError]
  );

  const handleOpenShortcutParentFolder = useCallback(
    async (item: LauncherItem): Promise<void> => {
      if (!item.originalPath) {
        showWarning('ショートカットのパスが見つかりません');
        return;
      }

      try {
        await window.electronAPI.openParentFolder({ ...item, path: item.originalPath });
        logWarn(`リンク先の親フォルダーを開きました: ${item.originalPath}`);
      } catch (err) {
        logError('リンク先の親フォルダーを開くのに失敗しました:', err);
        showError('リンク先の親フォルダーを開くのに失敗しました');
      }
    },
    [showError, showWarning]
  );

  return {
    handleCopyPath,
    handleCopyParentPath,
    handleCopyShortcutPath,
    handleCopyShortcutParentPath,
    handleOpenParentFolder,
    handleOpenShortcutParentFolder,
  };
}
