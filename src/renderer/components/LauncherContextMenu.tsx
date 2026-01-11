import React, { useEffect, useRef } from 'react';
import { PathUtils } from '@common/utils/pathUtils';
import { AppItem, LauncherItem } from '@common/types';
import { isGroupItem, isLauncherItem } from '@common/utils/typeGuards';

interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  item: AppItem | null;
  onClose: () => void;
  onCopyPath: (item: LauncherItem) => void;
  onCopyParentPath: (item: LauncherItem) => void;
  onOpenParentFolder: (item: LauncherItem) => void;
  onCopyShortcutPath?: (item: LauncherItem) => void;
  onCopyShortcutParentPath?: (item: LauncherItem) => void;
  onOpenShortcutParentFolder?: (item: LauncherItem) => void;
  onEditItem?: (item: AppItem) => void | Promise<void>;
  onAddToWorkspace?: (item: AppItem) => void | Promise<void>;
}

const LauncherContextMenu: React.FC<ContextMenuProps> = ({
  isVisible,
  position,
  item,
  onClose,
  onCopyPath,
  onCopyParentPath,
  onOpenParentFolder,
  onCopyShortcutPath,
  onCopyShortcutParentPath,
  onOpenShortcutParentFolder,
  onEditItem,
  onAddToWorkspace,
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

  const handleCopyPath = () => {
    if (item && isLauncherItem(item)) {
      onCopyPath(item);
      onClose();
    }
  };

  const handleCopyParentPath = () => {
    if (item && isLauncherItem(item)) {
      onCopyParentPath(item);
      onClose();
    }
  };

  const handleCopyShortcutPath = () => {
    if (item && isLauncherItem(item) && onCopyShortcutPath) {
      onCopyShortcutPath(item);
      onClose();
    }
  };

  const handleCopyShortcutParentPath = () => {
    if (item && isLauncherItem(item) && onCopyShortcutParentPath) {
      onCopyShortcutParentPath(item);
      onClose();
    }
  };

  const handleOpenParentFolder = () => {
    if (item && isLauncherItem(item)) {
      onOpenParentFolder(item);
      onClose();
    }
  };

  const handleOpenShortcutParentFolder = () => {
    if (item && isLauncherItem(item) && onOpenShortcutParentFolder) {
      onOpenShortcutParentFolder(item);
      onClose();
    }
  };

  const handleEditItem = async () => {
    if (item && onEditItem) {
      await Promise.resolve(onEditItem(item));
      onClose();
    }
  };

  const handleAddToWorkspace = async () => {
    if (item && onAddToWorkspace) {
      await Promise.resolve(onAddToWorkspace(item));
      onClose();
    }
  };

  // グループアイテムかどうかを判定
  const isGroup = item ? isGroupItem(item) : false;

  // ショートカットアイテムかどうかを判定
  const isShortcut = item && isLauncherItem(item) ? PathUtils.isShortcutItem(item) : false;

  // パスを取得するヘルパー関数
  const getFullPath = (): string => {
    return item && isLauncherItem(item) ? PathUtils.getFullPath(item) : '';
  };

  const getParentPath = (): string => {
    return item && isLauncherItem(item) && 'path' in item ? PathUtils.getParentPath(item.path) : '';
  };

  const getShortcutPath = (): string => {
    return item && isLauncherItem(item) && 'originalPath' in item ? item.originalPath || '' : '';
  };

  const getShortcutParentPath = (): string => {
    return item && isLauncherItem(item) && 'originalPath' in item && item.originalPath
      ? PathUtils.getParentPath(item.originalPath)
      : '';
  };

  const getAdjustedPosition = () => {
    const menuWidth = 200;
    // グループアイテムの場合：編集 + ワークスペースに追加（高さ100px）
    // 通常アイテムの場合：編集+ワークスペースに追加+基本3項目 + ショートカットで+3項目 + 区切り線
    const baseHeight = onEditItem ? 240 : 200;
    const menuHeight = isGroup ? 100 : isShortcut ? baseHeight + 140 : baseHeight;

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

  // URLやカスタムURIには親フォルダーが存在しない
  const hasParentFolder =
    item && isLauncherItem(item) && item.type !== 'url' && item.type !== 'customUri';

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
      {onEditItem && (
        <>
          <div className="context-menu-item" onClick={handleEditItem}>
            <span className="context-menu-icon">✏️</span>
            <span>編集</span>
          </div>
          {!isGroup && <div className="context-menu-divider" />}
        </>
      )}
      {onAddToWorkspace && (
        <>
          <div className="context-menu-item" onClick={handleAddToWorkspace}>
            <span className="context-menu-icon">⭐</span>
            <span>ワークスペースに追加</span>
          </div>
          {!isGroup && <div className="context-menu-divider" />}
        </>
      )}
      {!isGroup && (
        <>
          <div className="context-menu-item" onClick={handleCopyPath} title={getFullPath()}>
            <span className="context-menu-icon">📋</span>
            <span>パスをコピー</span>
          </div>
          {hasParentFolder && (
            <>
              <div
                className="context-menu-item"
                onClick={handleCopyParentPath}
                title={getParentPath()}
              >
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
          {isShortcut && (
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
        </>
      )}
    </div>
  );
};

export default LauncherContextMenu;
