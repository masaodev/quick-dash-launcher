import React, { useEffect, useRef } from 'react';
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

  const getAdjustedPosition = () => {
    const menuWidth = 200;
    const hasGroup = item?.groupId !== undefined;
    const menuHeight = hasGroup ? 200 : 160; // グループ所属の場合は項目が1つ多い

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
