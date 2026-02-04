import { useState } from 'react';
import type { MouseEvent } from 'react';
import { PathUtils } from '@common/utils/pathUtils';
import type { WorkspaceItem } from '@common/types';

interface ContextMenuState {
  isVisible: boolean;
  position: { x: number; y: number };
  item: WorkspaceItem | null;
}

const INITIAL_STATE: ContextMenuState = {
  isVisible: false,
  position: { x: 0, y: 0 },
  item: null,
};

/**
 * ワークスペースアイテムのコンテキストメニューを管理するカスタムフック
 */
export function useWorkspaceContextMenu(
  onMoveItemToGroup: (itemId: string, groupId?: string) => void,
  setEditingItemId: (id: string | null) => void
) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(INITIAL_STATE);

  const handleContextMenu = (item: WorkspaceItem) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isVisible: true,
      position: { x: e.clientX, y: e.clientY },
      item,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(INITIAL_STATE);
  };

  const handleEditFromContextMenu = (item: WorkspaceItem) => {
    setEditingItemId(item.id);
  };

  const handleRemoveFromGroup = (item: WorkspaceItem) => {
    if (item.groupId) {
      onMoveItemToGroup(item.id, undefined);
    }
  };

  // パス操作のヘルパー関数
  const copyPath = (path: string) => {
    window.electronAPI.copyToClipboard(path);
  };

  const openFolder = (path: string) => {
    window.electronAPI.openExternalUrl(`file:///${path}`);
  };

  const pathHandlers = {
    handleCopyPath: (item: WorkspaceItem) => {
      copyPath(item.path);
    },

    handleCopyParentPath: (item: WorkspaceItem) => {
      copyPath(PathUtils.getParentPath(item.path));
    },

    handleOpenParentFolder: (item: WorkspaceItem) => {
      openFolder(PathUtils.getParentPath(item.path));
    },

    handleCopyShortcutPath: (item: WorkspaceItem) => {
      if (item.originalPath) {
        copyPath(item.originalPath);
      }
    },

    handleCopyShortcutParentPath: (item: WorkspaceItem) => {
      if (item.originalPath) {
        copyPath(PathUtils.getParentPath(item.originalPath));
      }
    },

    handleOpenShortcutParentFolder: (item: WorkspaceItem) => {
      if (item.originalPath) {
        openFolder(PathUtils.getParentPath(item.originalPath));
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
