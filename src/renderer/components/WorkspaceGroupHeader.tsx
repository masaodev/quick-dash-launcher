import React, { useState, useRef, useEffect } from 'react';
import type { WorkspaceGroup } from '@common/types';

interface WorkspaceGroupHeaderProps {
  group: WorkspaceGroup;
  itemCount: number;
  isEditing: boolean;
  onToggle: (groupId: string) => void;
  onUpdate: (groupId: string, updates: Partial<WorkspaceGroup>) => void;
  onDelete: (groupId: string) => void;
  onArchive: (groupId: string) => void;
  onStartEdit: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
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
  onDelete: _onDelete,
  onArchive: _onArchive,
  onStartEdit,
  onDragOver,
  onDrop,
  onGroupDragStart,
  onGroupDragEnd,
  onGroupDragOverForReorder,
  onGroupDropForReorder,
  onContextMenu,
}) => {
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

  const handleStartEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartEdit();
  };

  const handleSaveEdit = () => {
    if (editName.trim() && editName !== group.name) {
      onUpdate(group.id, { name: editName.trim() });
    }
    onStartEdit(); // 編集モードを終了
  };

  const handleCancelEdit = () => {
    setEditName(group.name);
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
          title={group.name}
        >
          {group.name}
        </span>
      )}

      {/* アイテム数バッジ */}
      <span className="workspace-group-badge">{itemCount}個</span>
    </div>
  );
};

export default WorkspaceGroupHeader;
