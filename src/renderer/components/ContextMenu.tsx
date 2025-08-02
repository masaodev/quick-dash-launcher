import React, { useEffect, useRef } from 'react';

import { LauncherItem } from '../../common/types';

interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  item: LauncherItem | null;
  onClose: () => void;
  onCopyPath: (item: LauncherItem) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  isVisible,
  position,
  item,
  onClose,
  onCopyPath,
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

  const getAdjustedPosition = () => {
    const menuWidth = 160;
    const menuHeight = 40;

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
    </div>
  );
};

export default ContextMenu;
