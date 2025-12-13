import React, { useState, useRef, useEffect } from 'react';
import type { WorkspaceItem } from '@common/types';

interface WorkspaceItemCardProps {
  item: WorkspaceItem;
  isEditing: boolean;
  onLaunch: (item: WorkspaceItem) => void;
  onRemove: (id: string) => void;
  onUpdateDisplayName: (id: string, displayName: string) => void;
  onStartEdit: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const WorkspaceItemCard: React.FC<WorkspaceItemCardProps> = ({
  item,
  isEditing,
  onLaunch,
  onRemove,
  onUpdateDisplayName,
  onStartEdit,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onContextMenu,
}) => {
  const [editValue, setEditValue] = useState(item.displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!isEditing) {
      onLaunch(item);
    }
  };

  const handleDoubleClick = () => {
    onStartEdit();
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(item.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onUpdateDisplayName(item.id, editValue);
    } else if (e.key === 'Escape') {
      setEditValue(item.displayName);
      onStartEdit(); // 編集モード終了
    }
  };

  const handleBlur = () => {
    if (editValue.trim() && editValue !== item.displayName) {
      onUpdateDisplayName(item.id, editValue);
    } else {
      setEditValue(item.displayName);
      onStartEdit(); // 編集モード終了
    }
  };

  const getDefaultIcon = () => {
    switch (item.type) {
      case 'url':
        return '🌐';
      case 'folder':
        return '📁';
      case 'app':
        return '⚙️';
      case 'file':
        return '📄';
      case 'customUri':
        return '🔗';
      default:
        return '📄';
    }
  };

  return (
    <div
      className="workspace-item-card"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={onContextMenu}
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="workspace-item-content">
        {item.icon && <img src={item.icon} alt="" className="workspace-item-icon" />}
        {!item.icon && <div className="workspace-item-icon-placeholder">{getDefaultIcon()}</div>}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="workspace-item-name-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="workspace-item-name">{item.displayName}</div>
        )}
      </div>
      <button className="workspace-item-delete-btn" onClick={handleRemoveClick} title="削除">
        ×
      </button>
    </div>
  );
};

export default WorkspaceItemCard;
