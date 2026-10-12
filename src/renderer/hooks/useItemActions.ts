import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LauncherItem } from '@common/types';
import { PathUtils } from '@common/utils/pathUtils';

import { logWarn, logError } from '../utils/debug';

import { useToast } from './useToast';

type CopyTarget = 'path' | 'parentPath' | 'shortcutPath' | 'shortcutParentPath';

export function useItemActions() {
  const { t } = useTranslation();
  const { showSuccess, showError, showWarning } = useToast();

  const copyToClipboard = useCallback(
    async (text: string, target: CopyTarget): Promise<void> => {
      const targetLabel = t(`launcher.itemActions.targets.${target}`);
      try {
        await window.electronAPI.copyToClipboard(text);
        logWarn(`${target} をコピーしました: ${text}`);
        showSuccess(t('launcher.itemActions.copied', { target: targetLabel }));
      } catch (err) {
        logError(`${target} のコピーに失敗しました:`, err);
        showError(t('launcher.itemActions.copyFailed', { target: targetLabel }));
      }
    },
    [showSuccess, showError, t]
  );

  const handleCopyPath = useCallback(
    async (item: LauncherItem): Promise<void> => {
      await copyToClipboard(PathUtils.getFullPath(item), 'path');
    },
    [copyToClipboard]
  );

  const handleCopyParentPath = useCallback(
    async (item: LauncherItem): Promise<void> => {
      if (item.type === 'url' || item.type === 'customUri') {
        showWarning(t('launcher.itemActions.noContainingFolderForUrl'));
        return;
      }

      const parentPath = PathUtils.getParentPath(item.path);
      if (!parentPath) {
        showWarning(t('launcher.itemActions.parentPathUnavailable'));
        return;
      }

      await copyToClipboard(parentPath, 'parentPath');
    },
    [copyToClipboard, showWarning, t]
  );

  const handleCopyShortcutPath = useCallback(
    async (item: LauncherItem): Promise<void> => {
      if (!item.originalPath) {
        showWarning(t('launcher.itemActions.shortcutPathNotFound'));
        return;
      }

      await copyToClipboard(item.originalPath, 'shortcutPath');
    },
    [copyToClipboard, showWarning, t]
  );

  const handleCopyShortcutParentPath = useCallback(
    async (item: LauncherItem): Promise<void> => {
      if (!item.originalPath) {
        showWarning(t('launcher.itemActions.shortcutPathNotFound'));
        return;
      }

      const parentPath = PathUtils.getParentPath(item.originalPath);
      if (!parentPath) {
        showWarning(t('launcher.itemActions.shortcutParentPathUnavailable'));
        return;
      }

      await copyToClipboard(parentPath, 'shortcutParentPath');
    },
    [copyToClipboard, showWarning, t]
  );

  const handleOpenParentFolder = useCallback(
    async (item: LauncherItem): Promise<void> => {
      try {
        await window.electronAPI.openParentFolder(item);
      } catch (err) {
        logError('親フォルダを開くのに失敗しました:', err);
        showError(t('launcher.itemActions.openContainingFolderFailed'));
      }
    },
    [showError, t]
  );

  const handleOpenShortcutParentFolder = useCallback(
    async (item: LauncherItem): Promise<void> => {
      if (!item.originalPath) {
        showWarning(t('launcher.itemActions.shortcutPathNotFound'));
        return;
      }

      try {
        await window.electronAPI.openParentFolder({ ...item, path: item.originalPath });
        logWarn(`リンク先の親フォルダを開きました: ${item.originalPath}`);
      } catch (err) {
        logError('リンク先の親フォルダを開くのに失敗しました:', err);
        showError(t('launcher.itemActions.openShortcutContainingFolderFailed'));
      }
    },
    [showError, showWarning, t]
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
