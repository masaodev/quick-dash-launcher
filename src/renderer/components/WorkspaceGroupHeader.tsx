import React, { useState, useRef, useEffect } from 'react';
import type { WorkspaceGroup } from '@common/types';

interface WorkspaceGroupHeaderProps {
  group: WorkspaceGroup;
  itemCount: number;
  onToggle: (groupId: string) => void;
  onUpdate: (groupId: string, updates: Partial<WorkspaceGroup>) => void;
  onDelete: (groupId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onGroupDragStart: (e: React.DragEvent) => void;
  onGroupDragEnd: () => void;
  onGroupDragOverForReorder: (e: React.DragEvent) => void;
  onGroupDropForReorder: (e: React.DragEvent) => void;
}

const WorkspaceGroupHeader: React.FC<WorkspaceGroupHeaderProps> = ({
  group,
  itemCount,
  onToggle,
  onUpdate,
  onDelete,
  onDragOver,
  onDrop,
  onGroupDragStart,
  onGroupDragEnd,
  onGroupDragOverForReorder,
  onGroupDropForReorder,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
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

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editName !== group.name) {
      onUpdate(group.id, { name: editName.trim() });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(group.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(group.id);
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
    // グループの並び替えとアイテムのドロップの両方に対応
    onDragOver(e);
    onGroupDragOverForReorder(e);
  };

  const handleDrop = (e: React.DragEvent) => {
    // アイテムのドロップかグループの並び替えかを判定
    const itemId = e.dataTransfer.getData('itemId');
    const groupId = e.dataTransfer.getData('groupId');
    const historyItemData = e.dataTransfer.getData('historyItem');

    if (itemId || historyItemData) {
      // アイテムのドロップ（ワークスペースアイテムまたは実行履歴アイテム）
      onDrop(e);
    } else if (groupId) {
      // グループの並び替え
      onGroupDropForReorder(e);
    }
  };

  return (
    <div
      className="workspace-group-header"
      onClick={handleToggle}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={
        {
          '--group-color': group.color,
        } as React.CSSProperties
      }
    >
      {/* 折りたたみアイコン（ドラッグハンドル） */}
      <span
        className={`workspace-group-collapse-icon ${group.collapsed ? 'collapsed' : ''}`}
        draggable={!isEditing}
        onDragStart={handleDragStart}
        onDragEnd={onGroupDragEnd}
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
        />
      ) : (
        <span className="workspace-group-name" onDoubleClick={handleStartEdit}>
          {group.name}
        </span>
      )}

      {/* アイテム数バッジ */}
      <span className="workspace-group-badge">{itemCount}個</span>

      {/* 編集・削除ボタン */}
      <div className="workspace-group-actions">
        <button
          className="workspace-group-edit-btn"
          onClick={handleStartEdit}
          title="グループ名を編集"
        >
          ✏️
        </button>
        <button
          className="workspace-group-delete-btn"
          onClick={handleDelete}
          title="グループを削除"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default WorkspaceGroupHeader;
