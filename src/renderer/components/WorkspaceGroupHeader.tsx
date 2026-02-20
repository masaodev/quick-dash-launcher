import React, { useState, useRef, useEffect } from 'react';
import type { WorkspaceGroup } from '@common/types';

interface WorkspaceGroupHeaderProps {
  group: WorkspaceGroup;
  itemCount: number;
  isEditing: boolean;
  depth: number;
  onToggle: (groupId: string) => void;
  onUpdate: (groupId: string, updates: Partial<WorkspaceGroup>) => void;
  onStartEdit: () => void;
  onGroupDragStart: (e: React.DragEvent) => void;
  onGroupDragOverForReorder: (e: React.DragEvent) => void;
  onGroupDropForReorder: (e: React.DragEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function WorkspaceGroupHeader({
  group,
  itemCount,
  isEditing,
  depth,
  onToggle,
  onUpdate,
  onStartEdit,
  onGroupDragStart,
  onGroupDragOverForReorder,
  onGroupDropForReorder,
  onContextMenu,
}: WorkspaceGroupHeaderProps): React.ReactElement {
  const [editName, setEditName] = useState(group.displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function handleSaveEdit(): void {
    if (editName.trim() && editName !== group.displayName) {
      onUpdate(group.id, { displayName: editName.trim() });
    }
    onStartEdit();
  }

  function handleCancelEdit(): void {
    setEditName(group.displayName);
    onStartEdit();
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  }

  function handleDragStart(e: React.DragEvent): void {
    if (isEditing) {
      e.preventDefault();
      return;
    }
    onGroupDragStart(e);
  }

  function handleDrop(e: React.DragEvent): void {
    const groupId = e.dataTransfer.getData('groupId');
    if (groupId) {
      // グループドラッグ: handleMixedDrop で同一親内なら並べ替え、
      // 異なる親ならイベントを伝播させて handleGroupDrop でグループ移動
      onGroupDropForReorder(e);
    }
    // アイテムドラッグ: イベントを伝播させ、親コンテナの handleGroupDrop でグループ間移動
  }

  const depthClass = depth > 0 ? ` workspace-group-depth-${depth}` : '';

  return (
    <div
      className={`workspace-group-header${depthClass}`}
      onClick={() => onToggle(group.id)}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragOver={onGroupDragOverForReorder}
      onDrop={handleDrop}
      onContextMenu={onContextMenu}
      style={{ '--group-color': group.color } as React.CSSProperties}
    >
      <span
        className={`workspace-group-collapse-icon ${group.collapsed ? 'collapsed' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        ▼
      </span>

      {group.customIcon && <span className="workspace-group-custom-icon">{group.customIcon}</span>}

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSaveEdit}
          className="workspace-group-name-input"
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="workspace-group-name"
          onDoubleClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
          onDragStart={(e) => e.stopPropagation()}
          title={group.displayName}
        >
          {group.displayName}
        </span>
      )}

      <span className="workspace-group-badge">{itemCount}個</span>
    </div>
  );
}

export default WorkspaceGroupHeader;
