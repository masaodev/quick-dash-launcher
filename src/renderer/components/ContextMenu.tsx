import React, { useEffect, useRef } from 'react';

import { LauncherItem } from '../../common/types';

interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  item: LauncherItem | null;
  onClose: () => void;
  onCopyPath: (item: LauncherItem) => void;
  onCopyParentPath: (item: LauncherItem) => void;
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

  // ショートカットアイテムかどうかを判定
  const isShortcutItem = item?.originalPath?.toLowerCase().endsWith('.lnk');

  const getAdjustedPosition = () => {
    const menuWidth = 200;
    const menuHeight = isShortcutItem ? 160 : 80;

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
      <div className="context-menu-item" onClick={handleCopyPath}>
        <span className="context-menu-icon">📋</span>
        <span>パスをコピー</span>
      </div>
      <div className="context-menu-item" onClick={handleCopyParentPath}>
        <span className="context-menu-icon">📁</span>
        <span>親フォルダーのパスをコピー</span>
      </div>
      {isShortcutItem && onCopyShortcutPath && (
        <div className="context-menu-item" onClick={handleCopyShortcutPath}>
          <span className="context-menu-icon">🔗</span>
          <span>ショートカットのパスをコピー</span>
        </div>
      )}
      {isShortcutItem && onCopyShortcutParentPath && (
        <div className="context-menu-item" onClick={handleCopyShortcutParentPath}>
          <span className="context-menu-icon">📂</span>
          <span>ショートカットの親フォルダーをコピー</span>
        </div>
      )}
    </div>
  );
};

export default ContextMenu;
