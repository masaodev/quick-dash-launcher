import { useState } from 'react';
import type { MouseEvent } from 'react';
import { PathUtils } from '@common/utils/pathUtils';
import type { WorkspaceItem } from '@common/types';

/**
 * コンテキストメニューの状態
 */
interface ContextMenuState {
  isVisible: boolean;
  position: { x: number; y: number };
  item: WorkspaceItem | null;
}

/**
 * ワークスペースアイテムのコンテキストメニューを管理するカスタムフック
 *
 * コンテキストメニューの表示/非表示、位置管理、
 * およびパス操作（コピー、親フォルダを開く）を提供します。
 *
 * @param onMoveItemToGroup アイテムをグループから削除するハンドラー
 * @param setEditingItemId 編集状態を設定するハンドラー
 * @returns コンテキストメニューの状態とハンドラー関数群
 *
 * @example
 * ```tsx
 * const {
 *   contextMenu,
 *   handleContextMenu,
 *   handleCloseContextMenu,
 *   handleEditFromContextMenu,
 *   handleRemoveFromGroup,
 *   pathHandlers
 * } = useWorkspaceContextMenu(onMoveItemToGroup, setEditingItemId);
 *
 * <WorkspaceContextMenu
 *   isVisible={contextMenu.isVisible}
 *   position={contextMenu.position}
 *   item={contextMenu.item}
 *   onClose={handleCloseContextMenu}
 *   {...pathHandlers}
 * />
 * ```
 */
export function useWorkspaceContextMenu(
  onMoveItemToGroup: (itemId: string, groupId?: string) => void,
  setEditingItemId: (id: string | null) => void
) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isVisible: false,
    position: { x: 0, y: 0 },
    item: null,
  });

  /**
   * コンテキストメニューを表示
   */
  const handleContextMenu = (item: WorkspaceItem) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isVisible: true,
      position: { x: e.clientX, y: e.clientY },
      item,
    });
  };

  /**
   * コンテキストメニューを閉じる
   */
  const handleCloseContextMenu = () => {
    setContextMenu({
      isVisible: false,
      position: { x: 0, y: 0 },
      item: null,
    });
  };

  /**
   * コンテキストメニューから編集モードに移行
   */
  const handleEditFromContextMenu = (item: WorkspaceItem) => {
    setEditingItemId(item.id);
  };

  /**
   * グループからアイテムを削除（未分類に戻す）
   */
  const handleRemoveFromGroup = (item: WorkspaceItem) => {
    if (item.groupId) {
      onMoveItemToGroup(item.id, undefined);
    }
  };

  /**
   * パス操作ハンドラー群
   */
  const pathHandlers = {
    /**
     * パスをクリップボードにコピー
     */
    handleCopyPath: (item: WorkspaceItem) => {
      window.electronAPI.copyToClipboard(item.path);
    },

    /**
     * 親フォルダのパスをクリップボードにコピー
     */
    handleCopyParentPath: (item: WorkspaceItem) => {
      const parentPath = PathUtils.getParentPath(item.path);
      window.electronAPI.copyToClipboard(parentPath);
    },

    /**
     * 親フォルダをエクスプローラーで開く
     */
    handleOpenParentFolder: async (item: WorkspaceItem) => {
      const parentPath = PathUtils.getParentPath(item.path);
      await window.electronAPI.openExternalUrl(`file:///${parentPath}`);
    },

    /**
     * ショートカットの実体パスをクリップボードにコピー
     */
    handleCopyShortcutPath: (item: WorkspaceItem) => {
      if (item.originalPath) {
        window.electronAPI.copyToClipboard(item.originalPath);
      }
    },

    /**
     * ショートカットの実体の親フォルダパスをクリップボードにコピー
     */
    handleCopyShortcutParentPath: (item: WorkspaceItem) => {
      if (item.originalPath) {
        const parentPath = PathUtils.getParentPath(item.originalPath);
        window.electronAPI.copyToClipboard(parentPath);
      }
    },

    /**
     * ショートカットの実体の親フォルダをエクスプローラーで開く
     */
    handleOpenShortcutParentFolder: async (item: WorkspaceItem) => {
      if (item.originalPath) {
        const parentPath = PathUtils.getParentPath(item.originalPath);
        await window.electronAPI.openExternalUrl(`file:///${parentPath}`);
      }
    },
  };

  return {
    contextMenu,
    handleContextMenu,
    handleCloseContextMenu,
    handleEditFromContextMenu,
    handleRemoveFromGroup,
    pathHandlers,
  };
}
