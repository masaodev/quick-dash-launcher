import React, { useState, useRef, useEffect } from 'react';
import type { WorkspaceGroup, GroupDropZone } from '@common/types';

interface WorkspaceGroupHeaderProps {
  group: WorkspaceGroup;
  itemCount: number;
  isEditing: boolean;
  depth: number;
  isDetachedRoot?: boolean;
  onCloseDetached?: () => void;
  /** 現在ドラッグ中の要素情報（null=ドラッグなし） */
  draggedElement: { id: string; kind: 'item' | 'group' } | null;
  /** このグループにネスト可能か（深さ制限チェック済み） */
  canNest: boolean;
  onToggle: (groupId: string) => void;
  onUpdate: (groupId: string, updates: Partial<WorkspaceGroup>) => void;
  onEndEdit: () => void;
  onGroupDragStart: (e: React.DragEvent) => void;
  onGroupDragEnd?: (e: React.DragEvent, groupId: string) => void;
  onGroupDragOverForReorder: (e: React.DragEvent) => void;
  onGroupDropForReorder: (e: React.DragEvent, dropZone: GroupDropZone) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function WorkspaceGroupHeader({
  group,
  itemCount,
  isEditing,
  depth,
  isDetachedRoot,
  onCloseDetached,
  draggedElement,
  canNest,
  onToggle,
  onUpdate,
  onEndEdit,
  onGroupDragStart,
  onGroupDragEnd,
  onGroupDragOverForReorder,
  onGroupDropForReorder,
  onContextMenu,
}: WorkspaceGroupHeaderProps): React.ReactElement {
  const [editName, setEditName] = useState(group.displayName);
  const [dropZone, setDropZone] = useState<GroupDropZone | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditName(group.displayName);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, group.displayName]);

  // ドラッグ終了時にゾーンをクリア
  useEffect(() => {
    if (!draggedElement) {
      setDropZone(null);
    }
  }, [draggedElement]);

  function handleSaveEdit(): void {
    if (editName.trim() && editName !== group.displayName) {
      onUpdate(group.id, { displayName: editName.trim() });
    }
    onEndEdit();
  }

  function handleCancelEdit(): void {
    setEditName(group.displayName);
    onEndEdit();
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

  function handleDragEnd(e: React.DragEvent): void {
    onGroupDragEnd?.(e, group.id);
  }

  /** ドロップゾーンを計算: ヘッダー内のマウスY位置に応じて before/nest/after を判定 */
  function calculateDropZone(e: React.DragEvent): GroupDropZone | null {
    if (!draggedElement) return null;
    // 自分自身（グループ）へのドラッグはゾーン表示しない
    if (draggedElement.kind === 'group' && draggedElement.id === group.id) return null;

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = (e.clientY - rect.top) / rect.height;

    if (canNest) {
      // ネスト可能: 上25%=before, 中央50%=nest, 下25%=after
      if (relativeY < 0.25) return 'before';
      if (relativeY > 0.75) return 'after';
      return 'nest';
    } else {
      // ネスト不可: 上50%=before, 下50%=after
      return relativeY < 0.5 ? 'before' : 'after';
    }
  }

  function handleDragOver(e: React.DragEvent): void {
    onGroupDragOverForReorder(e);
    const zone = calculateDropZone(e);
    setDropZone(zone);
  }

  function handleDragLeave(): void {
    setDropZone(null);
  }

  function handleDrop(e: React.DragEvent): void {
    const groupId = e.dataTransfer.getData('groupId');
    const itemId = e.dataTransfer.getData('itemId');
    const currentDropZone = dropZone;
    setDropZone(null);

    if (currentDropZone && (groupId || itemId)) {
      // ゾーン情報付きでハンドラーを呼び出す（グループ・アイテム共通）
      onGroupDropForReorder(e, currentDropZone);
    }
    // ゾーンなし: イベントを伝播させ、親コンテナの handleGroupDrop で処理
  }

  const depthClass = depth > 0 ? ` workspace-group-depth-${depth}` : '';

  return (
    <div
      className={`workspace-group-header${depthClass}${isDetachedRoot ? ' detached-root' : ''}`}
      data-drop-zone={dropZone || undefined}
      onClick={() => onToggle(group.id)}
      draggable={!isEditing && !isDetachedRoot}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={onContextMenu}
      style={{ '--group-color': group.color } as React.CSSProperties}
    >
      <span className={`workspace-group-collapse-icon ${group.collapsed ? 'collapsed' : ''}`}>
        ▼
      </span>

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
          onDragStart={(e) => e.stopPropagation()}
          title={group.displayName}
        >
          {group.displayName}
        </span>
      )}

      <span className="workspace-group-badge">{itemCount}個</span>

      {isDetachedRoot && onCloseDetached && (
        <button
          className="detached-group-close-btn"
          onClick={(e) => {
            e.stopPropagation();
            onCloseDetached();
          }}
          title="閉じる"
          aria-label="切り離しウィンドウを閉じる"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default WorkspaceGroupHeader;
