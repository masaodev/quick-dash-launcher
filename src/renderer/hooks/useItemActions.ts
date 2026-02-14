import { LauncherItem } from '@common/types';

import { logWarn, logError } from '../utils/debug';

import { useToast } from './useToast';

function getParentPath(path: string): string | null {
  const lastSlash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  return lastSlash > 0 ? path.substring(0, lastSlash) : null;
}

export function useItemActions() {
  const { showSuccess, showError, showWarning } = useToast();

  const copyToClipboard = async (text: string, label: string): Promise<void> => {
    try {
      await window.electronAPI.copyToClipboard(text);
      logWarn(`${label}をコピーしました: ${text}`);
      showSuccess(`${label}をコピーしました`);
    } catch (err) {
      logError(`${label}のコピーに失敗しました:`, err);
      showError(`${label}のコピーに失敗しました`);
    }
  };

  const handleCopyPath = async (item: LauncherItem): Promise<void> => {
    const fullCommand = item.args ? `${item.path} ${item.args}` : item.path;
    await copyToClipboard(fullCommand, 'パス');
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

    await copyToClipboard(parentPath, '親フォルダーのパス');
  };

  const handleCopyShortcutPath = async (item: LauncherItem): Promise<void> => {
    if (!item.originalPath) {
      showWarning('ショートカットのパスが見つかりません');
      return;
    }

    await copyToClipboard(item.originalPath, 'ショートカットのパス');
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

    await copyToClipboard(parentPath, 'ショートカットの親フォルダーのパス');
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
