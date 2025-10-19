import React, { useEffect, useRef } from 'react';

import { LauncherItem } from '../../common/types';
import { PathUtils } from '@common/utils/pathUtils';

interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  item: LauncherItem | null;
  onClose: () => void;
  onCopyPath: (item: LauncherItem) => void;
  onCopyParentPath: (item: LauncherItem) => void;
  onOpenParentFolder: (item: LauncherItem) => void;
  onCopyShortcutPath?: (item: LauncherItem) => void;
  onCopyShortcutParentPath?: (item: LauncherItem) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  isVisible,
  position,
  item,
  onClose,
  onCopyPath,
  onCopyParentPath,
  onOpenParentFolder,
  onCopyShortcutPath,
  onCopyShortcutParentPath,
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

  // ショートカットアイテムかどうかを判定
  const isShortcutItem = item ? PathUtils.isShortcutItem(item) : false;

  // パスを取得するヘルパー関数
  const getFullPath = (): string => {
    return item ? PathUtils.getFullPath(item) : '';
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
    const menuWidth = 200;
    // メニュー項目数に応じて高さを調整（基本3項目 + ショートカットで+2項目）
    const menuHeight = isShortcutItem ? 200 : 120;

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
  const hasParentFolder = item?.type !== 'url' && item?.type !== 'customUri';

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
      <div className="context-menu-item" onClick={handleCopyPath} title={getFullPath()}>
        <span className="context-menu-icon">📋</span>
        <span>パスをコピー</span>
      </div>
      {hasParentFolder && (
        <>
          <div className="context-menu-item" onClick={handleCopyParentPath} title={getParentPath()}>
            <span className="context-menu-icon">📁</span>
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
      {isShortcutItem && onCopyShortcutPath && (
        <div
          className="context-menu-item"
          onClick={handleCopyShortcutPath}
          title={getShortcutPath()}
        >
          <span className="context-menu-icon">🔗</span>
          <span>ショートカットのパスをコピー</span>
        </div>
      )}
      {isShortcutItem && onCopyShortcutParentPath && (
        <div
          className="context-menu-item"
          onClick={handleCopyShortcutParentPath}
          title={getShortcutParentPath()}
        >
          <span className="context-menu-icon">📂</span>
          <span>ショートカットの親フォルダーのパスをコピー</span>
        </div>
      )}
    </div>
  );
};

export default ContextMenu;
