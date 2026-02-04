import { LauncherItem } from '@common/types';

import { logWarn, logError } from '../utils/debug';

import { useToast } from './useToast';

function getParentPath(path: string): string | null {
  const lastSlash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return lastSlash > 0 ? path.substring(0, lastSlash) : null;
}

export function useItemActions() {
  const { showSuccess, showError, showWarning } = useToast();

  const handleCopyPath = async (item: LauncherItem): Promise<void> => {
    try {
      const fullCommand = item.args ? `${item.path} ${item.args}` : item.path;
      await window.electronAPI.copyToClipboard(fullCommand);
      logWarn(`パスをコピーしました: ${fullCommand}`);
      showSuccess('パスをコピーしました');
    } catch (err) {
      logError('パスのコピーに失敗しました:', err);
      showError('パスのコピーに失敗しました');
    }
  };

  const handleCopyParentPath = async (item: LauncherItem): Promise<void> => {
    if (item.type === 'url' || item.type === 'customUri') {
      showWarning('URLおよびカスタムURIには親フォルダーがありません');
      return;
    }

    const parentPath = getParentPath(item.path);
    if (!parentPath) {
      showWarning('親フォルダーのパスを取得できませんでした');
      return;
    }

    try {
      await window.electronAPI.copyToClipboard(parentPath);
      logWarn(`親フォルダーのパスをコピーしました: ${parentPath}`);
      showSuccess('親フォルダーのパスをコピーしました');
    } catch (err) {
      logError('親フォルダーのパスのコピーに失敗しました:', err);
      showError('親フォルダーのパスのコピーに失敗しました');
    }
  };

  const handleCopyShortcutPath = async (item: LauncherItem): Promise<void> => {
    if (!item.originalPath) {
      showWarning('ショートカットのパスが見つかりません');
      return;
    }

    try {
      await window.electronAPI.copyToClipboard(item.originalPath);
      logWarn(`ショートカットのパスをコピーしました: ${item.originalPath}`);
      showSuccess('ショートカットのパスをコピーしました');
    } catch (err) {
      logError('ショートカットのパスのコピーに失敗しました:', err);
      showError('ショートカットのパスのコピーに失敗しました');
    }
  };

  const handleCopyShortcutParentPath = async (item: LauncherItem): Promise<void> => {
    if (!item.originalPath) {
      showWarning('ショートカットのパスが見つかりません');
      return;
    }

    const parentPath = getParentPath(item.originalPath);
    if (!parentPath) {
      showWarning('ショートカットの親フォルダーのパスを取得できませんでした');
      return;
    }

    try {
      await window.electronAPI.copyToClipboard(parentPath);
      logWarn(`ショートカットの親フォルダーのパスをコピーしました: ${parentPath}`);
      showSuccess('ショートカットの親フォルダーのパスをコピーしました');
    } catch (err) {
      logError('ショートカットの親フォルダーのパスのコピーに失敗しました:', err);
      showError('ショートカットの親フォルダーのパスのコピーに失敗しました');
    }
  };

  const handleOpenParentFolder = async (item: LauncherItem): Promise<void> => {
    try {
      await window.electronAPI.openParentFolder(item);
    } catch (err) {
      logError('親フォルダーを開くのに失敗しました:', err);
      showError('親フォルダーを開くのに失敗しました');
    }
  };

  const handleOpenShortcutParentFolder = async (item: LauncherItem): Promise<void> => {
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
  };

  return {
    handleCopyPath,
    handleCopyParentPath,
    handleCopyShortcutPath,
    handleCopyShortcutParentPath,
    handleOpenParentFolder,
    handleOpenShortcutParentFolder,
  };
}
