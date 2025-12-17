import React, { useState, useRef, useEffect } from 'react';
import type { WorkspaceGroup } from '@common/types';

import ColorPicker from './ColorPicker';

interface WorkspaceGroupHeaderProps {
  group: WorkspaceGroup;
  itemCount: number;
  onToggle: (groupId: string) => void;
  onUpdate: (groupId: string, updates: Partial<WorkspaceGroup>) => void;
  onDelete: (groupId: string) => void;
  onArchive: (groupId: string) => void;
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
  onArchive,
  onDragOver,
  onDrop,
  onGroupDragStart,
  onGroupDragEnd,
  onGroupDragOverForReorder,
  onGroupDropForReorder,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
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

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArchive(group.id);
  };

  const handleColorButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsColorPickerOpen(!isColorPickerOpen);
  };

  const handleColorSelect = (color: string) => {
    onUpdate(group.id, { color });
    setIsColorPickerOpen(false);
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

  // グループ名やボタン部分でのドラッグを無効化
  const preventDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`workspace-group-header ${isColorPickerOpen ? 'color-picker-open' : ''}`}
      onClick={handleToggle}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragEnd={onGroupDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
          onDoubleClick={handleStartEdit}
          onDragStart={preventDragStart}
        >
          {group.name}
        </span>
      )}

      {/* アイテム数バッジ */}
      <span className="workspace-group-badge">{itemCount}個</span>

      {/* 編集・削除ボタン */}
      <div className="workspace-group-actions" onDragStart={preventDragStart}>
        <button
          className="workspace-group-color-btn"
          onClick={handleColorButtonClick}
          title="グループの色を変更"
        >
          🎨
        </button>
        <button
          className="workspace-group-edit-btn"
          onClick={handleStartEdit}
          title="グループ名を編集"
        >
          ✏️
        </button>
        <button
          className="workspace-group-archive-btn"
          onClick={handleArchive}
          title="グループをアーカイブ"
        >
          📦
        </button>
        <button
          className="workspace-group-delete-btn"
          onClick={handleDelete}
          title="グループを削除"
        >
          🗑️
        </button>
      </div>

      {/* カラーピッカー（actionsの外に配置） */}
      {isColorPickerOpen && (
        <ColorPicker
          onSelectColor={handleColorSelect}
          onClose={() => setIsColorPickerOpen(false)}
          currentColor={group.color}
        />
      )}
    </div>
  );
};

export default WorkspaceGroupHeader;
