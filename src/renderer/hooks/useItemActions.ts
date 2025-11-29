import { LauncherItem } from '../../common/types';
import { logWarn } from '../utils/debug';

/**
 * アイテムに対する各種アクション（コピー、親フォルダを開く等）を管理するカスタムフック
 */
export const useItemActions = () => {
  /**
   * アイテムのパスをクリップボードにコピー
   */
  const handleCopyPath = async (item: LauncherItem) => {
    try {
      // 引数がある場合は結合してコピー
      const fullCommand = item.args ? `${item.path} ${item.args}` : item.path;
      await window.electronAPI.copyToClipboard(fullCommand);
      logWarn(`パスをコピーしました: ${fullCommand}`);
    } catch (err) {
      console.error('パスのコピーに失敗しました:', err);
      alert('パスのコピーに失敗しました');
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
        alert('URLおよびカスタムURIには親フォルダーがありません');
        return;
      }

      // Get parent directory path
      const path = item.path;
      const lastSlash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));

      if (lastSlash > 0) {
        parentPath = path.substring(0, lastSlash);
      } else {
        alert('親フォルダーのパスを取得できませんでした');
        return;
      }

      await window.electronAPI.copyToClipboard(parentPath);
      logWarn(`親フォルダーのパスをコピーしました: ${parentPath}`);
    } catch (err) {
      console.error('親フォルダーのパスのコピーに失敗しました:', err);
      alert('親フォルダーのパスのコピーに失敗しました');
    }
  };

  /**
   * ショートカットのパスをクリップボードにコピー
   */
  const handleCopyShortcutPath = async (item: LauncherItem) => {
    try {
      if (!item.originalPath) {
        alert('ショートカットのパスが見つかりません');
        return;
      }

      await window.electronAPI.copyToClipboard(item.originalPath);
      logWarn(`ショートカットのパスをコピーしました: ${item.originalPath}`);
    } catch (err) {
      console.error('ショートカットのパスのコピーに失敗しました:', err);
      alert('ショートカットのパスのコピーに失敗しました');
    }
  };

  /**
   * ショートカットの親フォルダのパスをクリップボードにコピー
   */
  const handleCopyShortcutParentPath = async (item: LauncherItem) => {
    try {
      if (!item.originalPath) {
        alert('ショートカットのパスが見つかりません');
        return;
      }

      // Get parent directory path of the shortcut file
      const path = item.originalPath;
      const lastSlash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));

      if (lastSlash > 0) {
        const parentPath = path.substring(0, lastSlash);
        await window.electronAPI.copyToClipboard(parentPath);
        logWarn(`ショートカットの親フォルダーのパスをコピーしました: ${parentPath}`);
      } else {
        alert('ショートカットの親フォルダーのパスを取得できませんでした');
      }
    } catch (err) {
      console.error('ショートカットの親フォルダーのパスのコピーに失敗しました:', err);
      alert('ショートカットの親フォルダーのパスのコピーに失敗しました');
    }
  };

  /**
   * アイテムの親フォルダをエクスプローラーで開く
   */
  const handleOpenParentFolder = async (item: LauncherItem) => {
    try {
      await window.electronAPI.openParentFolder(item);
    } catch (err) {
      console.error('親フォルダーを開くのに失敗しました:', err);
      alert('親フォルダーを開くのに失敗しました');
    }
  };

  /**
   * ショートカットのリンク先の親フォルダをエクスプローラーで開く
   */
  const handleOpenShortcutParentFolder = async (item: LauncherItem) => {
    try {
      if (!item.originalPath) {
        alert('ショートカットのパスが見つかりません');
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
      console.error('リンク先の親フォルダーを開くのに失敗しました:', err);
      alert('リンク先の親フォルダーを開くのに失敗しました');
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
