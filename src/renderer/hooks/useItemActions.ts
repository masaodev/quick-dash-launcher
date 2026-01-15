import { LauncherItem } from '@common/types';

import { logWarn, logError } from '../utils/debug';

import { useToast } from './useToast';

/**
 * アイテムに対する各種アクション（コピー、親フォルダを開く等）を管理するカスタムフック
 */
export const useItemActions = () => {
  const { showSuccess, showError, showWarning } = useToast();
  /**
   * アイテムのパスをクリップボードにコピー
   */
  const handleCopyPath = async (item: LauncherItem) => {
    try {
      // 引数がある場合は結合してコピー
      const fullCommand = item.args ? `${item.path} ${item.args}` : item.path;
      await window.electronAPI.copyToClipboard(fullCommand);
      logWarn(`パスをコピーしました: ${fullCommand}`);
      showSuccess('パスをコピーしました');
    } catch (err) {
      logError('パスのコピーに失敗しました:', err);
      showError('パスのコピーに失敗しました');
    }
  };

  /**
   * アイテムの親フォルダのパスをクリップボードにコピー
   */
  const handleCopyParentPath = async (item: LauncherItem) => {
    try {
      let parentPath = '';

      // URL types don't have a parent path
      if (item.type === 'url' || item.type === 'customUri') {
        showWarning('URLおよびカスタムURIには親フォルダーがありません');
        return;
      }

      // Get parent directory path
      const path = item.path;
      const lastSlash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));

      if (lastSlash > 0) {
        parentPath = path.substring(0, lastSlash);
      } else {
        showWarning('親フォルダーのパスを取得できませんでした');
        return;
      }

      await window.electronAPI.copyToClipboard(parentPath);
      logWarn(`親フォルダーのパスをコピーしました: ${parentPath}`);
      showSuccess('親フォルダーのパスをコピーしました');
    } catch (err) {
      logError('親フォルダーのパスのコピーに失敗しました:', err);
      showError('親フォルダーのパスのコピーに失敗しました');
    }
  };

  /**
   * ショートカットのパスをクリップボードにコピー
   */
  const handleCopyShortcutPath = async (item: LauncherItem) => {
    try {
      if (!item.originalPath) {
        showWarning('ショートカットのパスが見つかりません');
        return;
      }

      await window.electronAPI.copyToClipboard(item.originalPath);
      logWarn(`ショートカットのパスをコピーしました: ${item.originalPath}`);
      showSuccess('ショートカットのパスをコピーしました');
    } catch (err) {
      logError('ショートカットのパスのコピーに失敗しました:', err);
      showError('ショートカットのパスのコピーに失敗しました');
    }
  };

  /**
   * ショートカットの親フォルダのパスをクリップボードにコピー
   */
  const handleCopyShortcutParentPath = async (item: LauncherItem) => {
    try {
      if (!item.originalPath) {
        showWarning('ショートカットのパスが見つかりません');
        return;
      }

      // Get parent directory path of the shortcut file
      const path = item.originalPath;
      const lastSlash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));

      if (lastSlash > 0) {
        const parentPath = path.substring(0, lastSlash);
        await window.electronAPI.copyToClipboard(parentPath);
        logWarn(`ショートカットの親フォルダーのパスをコピーしました: ${parentPath}`);
        showSuccess('ショートカットの親フォルダーのパスをコピーしました');
      } else {
        showWarning('ショートカットの親フォルダーのパスを取得できませんでした');
      }
    } catch (err) {
      logError('ショートカットの親フォルダーのパスのコピーに失敗しました:', err);
      showError('ショートカットの親フォルダーのパスのコピーに失敗しました');
    }
  };

  /**
   * アイテムの親フォルダをエクスプローラーで開く
   */
  const handleOpenParentFolder = async (item: LauncherItem) => {
    try {
      await window.electronAPI.openParentFolder(item);
    } catch (err) {
      logError('親フォルダーを開くのに失敗しました:', err);
      showError('親フォルダーを開くのに失敗しました');
    }
  };

  /**
   * ショートカットのリンク先の親フォルダをエクスプローラーで開く
   */
  const handleOpenShortcutParentFolder = async (item: LauncherItem) => {
    try {
      if (!item.originalPath) {
        showWarning('ショートカットのパスが見つかりません');
        return;
      }

      // リンク先のパスで一時的なアイテムを作成してopenParentFolderを使用
      const tempItem: LauncherItem = {
        ...item,
        path: item.originalPath,
      };

      await window.electronAPI.openParentFolder(tempItem);
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
};
