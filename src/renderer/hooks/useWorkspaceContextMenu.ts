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
   * ジェネリックなパス操作ハンドラー
   * @param item ワークスペースアイテム
   * @param operation 操作タイプ（'copy' | 'open'）
   * @param pathType パスタイプ（'item' | 'parent'）
   * @param useOriginalPath ショートカットの実体パスを使用するか
   */
  const handlePathOperation = async (
    item: WorkspaceItem,
    operation: 'copy' | 'open',
    pathType: 'item' | 'parent',
    useOriginalPath: boolean = false
  ) => {
    // ベースパスを取得
    let basePath: string;
    if (useOriginalPath) {
      if (!item.originalPath) return;
      basePath = item.originalPath;
    } else {
      basePath = item.path;
    }

    // パスタイプに応じてパスを決定
    const targetPath = pathType === 'parent' ? PathUtils.getParentPath(basePath) : basePath;

    // 操作を実行
    if (operation === 'copy') {
      window.electronAPI.copyToClipboard(targetPath);
    } else if (operation === 'open') {
      await window.electronAPI.openExternalUrl(`file:///${targetPath}`);
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
      handlePathOperation(item, 'copy', 'item', false);
    },

    /**
     * 親フォルダのパスをクリップボードにコピー
     */
    handleCopyParentPath: (item: WorkspaceItem) => {
      handlePathOperation(item, 'copy', 'parent', false);
    },

    /**
     * 親フォルダをエクスプローラーで開く
     */
    handleOpenParentFolder: async (item: WorkspaceItem) => {
      await handlePathOperation(item, 'open', 'parent', false);
    },

    /**
     * ショートカットの実体パスをクリップボードにコピー
     */
    handleCopyShortcutPath: (item: WorkspaceItem) => {
      handlePathOperation(item, 'copy', 'item', true);
    },

    /**
     * ショートカットの実体の親フォルダパスをクリップボードにコピー
     */
    handleCopyShortcutParentPath: (item: WorkspaceItem) => {
      handlePathOperation(item, 'copy', 'parent', true);
    },

    /**
     * ショートカットの実体の親フォルダをエクスプローラーで開く
     */
    handleOpenShortcutParentFolder: async (item: WorkspaceItem) => {
      await handlePathOperation(item, 'open', 'parent', true);
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
