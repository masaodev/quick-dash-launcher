import React, { useEffect, useRef } from 'react';
import { PathUtils } from '@common/utils/pathUtils';
import type { WorkspaceItem } from '@common/types';

interface WorkspaceContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  item: WorkspaceItem | null;
  onClose: () => void;
  onEdit: (item: WorkspaceItem) => void;
  onLaunch: (item: WorkspaceItem) => void;
  onRemove: (id: string) => void;
  onRemoveFromGroup: (item: WorkspaceItem) => void;
  onCopyPath: (item: WorkspaceItem) => void;
  onCopyParentPath: (item: WorkspaceItem) => void;
  onOpenParentFolder: (item: WorkspaceItem) => void;
  onCopyShortcutPath?: (item: WorkspaceItem) => void;
  onCopyShortcutParentPath?: (item: WorkspaceItem) => void;
  onOpenShortcutParentFolder?: (item: WorkspaceItem) => void;
}

const WorkspaceContextMenu: React.FC<WorkspaceContextMenuProps> = ({
  isVisible,
  position,
  item,
  onClose,
  onEdit,
  onLaunch,
  onRemove,
  onRemoveFromGroup,
  onCopyPath,
  onCopyParentPath,
  onOpenParentFolder,
  onCopyShortcutPath,
  onCopyShortcutParentPath,
  onOpenShortcutParentFolder,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);

  const handleEdit = () => {
    if (item) {
      onEdit(item);
      onClose();
    }
  };

  const handleLaunch = () => {
    if (item) {
      onLaunch(item);
      onClose();
    }
  };

  const handleRemove = () => {
    if (item) {
      onRemove(item.id);
      onClose();
    }
  };

  const handleRemoveFromGroup = () => {
    if (item) {
      onRemoveFromGroup(item);
      onClose();
    }
  };

  const handleCopyPath = () => {
    if (item) {
      onCopyPath(item);
      onClose();
    }
  };

  const handleCopyParentPath = () => {
    if (item) {
      onCopyParentPath(item);
      onClose();
    }
  };

  const handleCopyShortcutPath = () => {
    if (item && onCopyShortcutPath) {
      onCopyShortcutPath(item);
      onClose();
    }
  };

  const handleCopyShortcutParentPath = () => {
    if (item && onCopyShortcutParentPath) {
      onCopyShortcutParentPath(item);
      onClose();
    }
  };

  const handleOpenParentFolder = () => {
    if (item) {
      onOpenParentFolder(item);
      onClose();
    }
  };

  const handleOpenShortcutParentFolder = () => {
    if (item && onOpenShortcutParentFolder) {
      onOpenShortcutParentFolder(item);
      onClose();
    }
  };

  // ショートカットアイテムかどうかを判定
  const isShortcutItem = item?.originalPath ? true : false;

  // パスを取得するヘルパー関数
  const getFullPath = (): string => {
    return item ? item.path : '';
  };

  const getParentPath = (): string => {
    return item ? PathUtils.getParentPath(item.path) : '';
  };

  const getShortcutPath = (): string => {
    return item?.originalPath || '';
  };

  const getShortcutParentPath = (): string => {
    return item?.originalPath ? PathUtils.getParentPath(item.originalPath) : '';
  };

  const getAdjustedPosition = () => {
    const menuWidth = 250;
    const hasGroup = item?.groupId !== undefined;
    const baseHeight = 240; // 基本項目（名前変更、起動、パスコピー、親フォルダー系、削除）
    const groupHeight = hasGroup ? 40 : 0; // グループから削除
    const shortcutHeight = isShortcutItem ? 140 : 0; // ショートカット関連項目
    const menuHeight = baseHeight + groupHeight + shortcutHeight;

    let adjustedX = position.x;
    let adjustedY = position.y;

    if (position.x + menuWidth > window.innerWidth) {
      adjustedX = position.x - menuWidth;
    }

    if (position.y + menuHeight > window.innerHeight) {
      adjustedY = position.y - menuHeight;
    }

    return { x: Math.max(0, adjustedX), y: Math.max(0, adjustedY) };
  };

  if (!isVisible || !item) {
    return null;
  }

  const adjustedPosition = getAdjustedPosition();
  const hasGroup = item.groupId !== undefined;
  // URLやカスタムURIには親フォルダーが存在しない
  const hasParentFolder = item.type !== 'url' && item.type !== 'customUri';

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        zIndex: 1000,
      }}
    >
      <div className="context-menu-item" onClick={handleEdit}>
        <span className="context-menu-icon">✏️</span>
        <span>名前を変更</span>
      </div>
      <div className="context-menu-item" onClick={handleLaunch}>
        <span className="context-menu-icon">▶️</span>
        <span>起動</span>
      </div>
      <div className="context-menu-divider" />
      <div className="context-menu-item" onClick={handleCopyPath} title={getFullPath()}>
        <span className="context-menu-icon">📋</span>
        <span>パスをコピー</span>
      </div>
      {hasParentFolder && (
        <>
          <div className="context-menu-item" onClick={handleCopyParentPath} title={getParentPath()}>
            <span className="context-menu-icon">📋</span>
            <span>親フォルダーのパスをコピー</span>
          </div>
          <div
            className="context-menu-item"
            onClick={handleOpenParentFolder}
            title={getParentPath()}
          >
            <span className="context-menu-icon">📂</span>
            <span>親フォルダーを開く</span>
          </div>
        </>
      )}
      {isShortcutItem && (
        <>
          <div className="context-menu-divider" />
          {onCopyShortcutPath && (
            <div
              className="context-menu-item"
              onClick={handleCopyShortcutPath}
              title={getShortcutPath()}
            >
              <span className="context-menu-icon">📋</span>
              <span>リンク先のパスをコピー</span>
            </div>
          )}
          {onCopyShortcutParentPath && (
            <div
              className="context-menu-item"
              onClick={handleCopyShortcutParentPath}
              title={getShortcutParentPath()}
            >
              <span className="context-menu-icon">📋</span>
              <span>リンク先の親フォルダーのパスをコピー</span>
            </div>
          )}
          {onOpenShortcutParentFolder && (
            <div
              className="context-menu-item"
              onClick={handleOpenShortcutParentFolder}
              title={getShortcutParentPath()}
            >
              <span className="context-menu-icon">📂</span>
              <span>リンク先の親フォルダーを開く</span>
            </div>
          )}
        </>
      )}
      <div className="context-menu-divider" />
      {hasGroup && (
        <>
          <div className="context-menu-item" onClick={handleRemoveFromGroup}>
            <span className="context-menu-icon">📤</span>
            <span>グループから削除</span>
          </div>
          <div className="context-menu-divider" />
        </>
      )}
      <div className="context-menu-item" onClick={handleRemove}>
        <span className="context-menu-icon">🗑️</span>
        <span>ワークスペースから削除</span>
      </div>
    </div>
  );
};

export default WorkspaceContextMenu;
