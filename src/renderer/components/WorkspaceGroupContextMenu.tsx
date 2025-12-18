import React, { useEffect, useRef, useState } from 'react';
import type { WorkspaceGroup } from '@common/types';

import ColorPicker from './ColorPicker';

interface WorkspaceGroupContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  group: WorkspaceGroup | null;
  onClose: () => void;
  onRename: (group: WorkspaceGroup) => void;
  onChangeColor: (groupId: string, color: string) => void;
  onArchive: (groupId: string) => void;
  onDelete: (groupId: string) => void;
}

const WorkspaceGroupContextMenu: React.FC<WorkspaceGroupContextMenuProps> = ({
  isVisible,
  position,
  group,
  onClose,
  onRename,
  onChangeColor,
  onArchive,
  onDelete,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
        setShowColorPicker(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showColorPicker) {
          setShowColorPicker(false);
        } else {
          onClose();
        }
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
  }, [isVisible, showColorPicker, onClose]);

  const handleRename = () => {
    if (group) {
      onRename(group);
      onClose();
    }
  };

  const handleShowColorPicker = () => {
    setShowColorPicker(true);
  };

  const handleColorSelect = (color: string) => {
    if (group) {
      onChangeColor(group.id, color);
      setShowColorPicker(false);
      onClose();
    }
  };

  const handleArchive = () => {
    if (group) {
      onArchive(group.id);
      onClose();
    }
  };

  const handleDelete = () => {
    if (group) {
      onDelete(group.id);
      onClose();
    }
  };

  const getAdjustedPosition = () => {
    const menuWidth = 250;
    const menuHeight = showColorPicker ? 400 : 200; // カラーピッカー表示時は高さを増やす

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

  if (!isVisible || !group) {
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
        zIndex: 9999,
      }}
    >
      <div className="context-menu-item" onClick={handleRename}>
        <span className="context-menu-icon">✏️</span>
        <span>名前を変更</span>
      </div>
      <div className="context-menu-item" onClick={handleShowColorPicker}>
        <span className="context-menu-icon">🎨</span>
        <span>色を変更</span>
      </div>
      <div className="context-menu-divider" />
      <div className="context-menu-item" onClick={handleArchive}>
        <span className="context-menu-icon">📦</span>
        <span>アーカイブ</span>
      </div>
      <div className="context-menu-item" onClick={handleDelete}>
        <span className="context-menu-icon">🗑️</span>
        <span>削除</span>
      </div>

      {/* カラーピッカー */}
      {showColorPicker && (
        <div style={{ marginTop: '8px', padding: '8px' }}>
          <ColorPicker
            onSelectColor={handleColorSelect}
            onClose={() => setShowColorPicker(false)}
            currentColor={group.color}
          />
        </div>
      )}
    </div>
  );
};

export default WorkspaceGroupContextMenu;
