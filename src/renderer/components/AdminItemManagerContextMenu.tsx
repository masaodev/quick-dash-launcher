import React, { useEffect, useRef } from 'react';
import { RawDataLine } from '@common/types';

const MENU_DIMENSIONS = {
  width: 200,
  height: 150,
} as const;

interface EditModeContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  selectedLines: RawDataLine[];
  onClose: () => void;
  onDuplicate: (lines: RawDataLine[]) => void;
  onEdit: (line: RawDataLine) => void;
  onDelete: (lines: RawDataLine[]) => void;
}

const AdminItemManagerContextMenu: React.FC<EditModeContextMenuProps> = ({
  isVisible,
  position,
  selectedLines,
  onClose,
  onDuplicate,
  onEdit,
  onDelete,
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

  const handleDuplicate = () => {
    onDuplicate(selectedLines);
    onClose();
  };

  const handleEdit = () => {
    if (selectedLines.length === 1) {
      onEdit(selectedLines[0]);
      onClose();
    }
  };

  const handleDelete = () => {
    onDelete(selectedLines);
    onClose();
  };

  // 画面外に出ないように位置を調整
  const getAdjustedPosition = () => {
    let adjustedX = position.x;
    let adjustedY = position.y;

    if (position.x + MENU_DIMENSIONS.width > window.innerWidth) {
      adjustedX = position.x - MENU_DIMENSIONS.width;
    }

    if (position.y + MENU_DIMENSIONS.height > window.innerHeight) {
      adjustedY = position.y - MENU_DIMENSIONS.height;
    }

    return { x: Math.max(0, adjustedX), y: Math.max(0, adjustedY) };
  };

  if (!isVisible || selectedLines.length === 0) {
    return null;
  }

  const adjustedPosition = getAdjustedPosition();
  const isSingleLine = selectedLines.length === 1;
  const lineCount = selectedLines.length;

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
      <div className="context-menu-item" onClick={handleDuplicate}>
        <span className="context-menu-icon">📋</span>
        <span>複製{!isSingleLine && ` (${lineCount}行)`}</span>
      </div>

      {isSingleLine && (
        <div className="context-menu-item" onClick={handleEdit}>
          <span className="context-menu-icon">✏️</span>
          <span>詳細編集</span>
        </div>
      )}

      <div className="context-menu-divider" />

      <div className="context-menu-item" onClick={handleDelete}>
        <span className="context-menu-icon">🗑️</span>
        <span>削除{!isSingleLine && ` (${lineCount}行)`}</span>
      </div>
    </div>
  );
};

export default AdminItemManagerContextMenu;
