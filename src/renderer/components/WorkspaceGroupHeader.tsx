import React, { useState, useRef, useEffect } from 'react';
import type { WorkspaceGroup } from '@common/types';

interface WorkspaceGroupHeaderProps {
  group: WorkspaceGroup;
  itemCount: number;
  isEditing: boolean;
  onToggle: (groupId: string) => void;
  onUpdate: (groupId: string, updates: Partial<WorkspaceGroup>) => void;
  onStartEdit: () => void;
  onGroupDragStart: (e: React.DragEvent) => void;
  onGroupDragEnd: () => void;
  onGroupDragOverForReorder: (e: React.DragEvent) => void;
  onGroupDropForReorder: (e: React.DragEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const WorkspaceGroupHeader: React.FC<WorkspaceGroupHeaderProps> = ({
  group,
  itemCount,
  isEditing,
  onToggle,
  onUpdate,
  onStartEdit,
  onGroupDragStart,
  onGroupDragEnd,
  onGroupDragOverForReorder,
  onGroupDropForReorder,
  onContextMenu,
}) => {
  const [editName, setEditName] = useState(group.displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  // 編集モードに入ったときにフォーカス
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleToggle = () => {
    onToggle(group.id);
  };

  const handleStartEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartEdit();
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editName !== group.displayName) {
      onUpdate(group.id, { displayName: editName.trim() });
    }
    onStartEdit(); // 編集モードを終了
  };

  const handleCancelEdit = () => {
    setEditName(group.displayName);
    onStartEdit(); // 編集モードを終了
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    // 編集モード中はドラッグを無効化
    if (isEditing) {
      e.preventDefault();
      return;
    }
    onGroupDragStart(e);
  };

  const handleDragOver = (e: React.DragEvent) => {
    // グループの並び替え用（アイテムドロップは親divが処理）
    onGroupDragOverForReorder(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    // グループの並び替えのみ処理（アイテムドロップは親divにバブルアップ）
    const groupId = e.dataTransfer.getData('groupId');
    if (groupId) {
      e.stopPropagation(); // グループ並び替えの場合のみバブルアップを停止
      onGroupDropForReorder(e);
    }
    // アイテムドロップは親divのonDropが処理するため、ここでは何もしない
  };

  // グループ名やボタン部分でのドラッグを無効化
  const preventDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="workspace-group-header"
      onClick={handleToggle}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragEnd={onGroupDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={onContextMenu}
      style={
        {
          '--group-color': group.color,
        } as React.CSSProperties
      }
    >
      {/* 折りたたみアイコン */}
      <span
        className={`workspace-group-collapse-icon ${group.collapsed ? 'collapsed' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        ▼
      </span>

      {/* グループ名（編集モード対応） */}
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
          onDragStart={preventDragStart}
        />
      ) : (
        <span
          className="workspace-group-name"
          onDoubleClick={handleStartEditClick}
          onDragStart={preventDragStart}
          title={group.displayName}
        >
          {group.displayName}
        </span>
      )}

      {/* アイテム数バッジ */}
      <span className="workspace-group-badge">{itemCount}個</span>
    </div>
  );
};

export default WorkspaceGroupHeader;
