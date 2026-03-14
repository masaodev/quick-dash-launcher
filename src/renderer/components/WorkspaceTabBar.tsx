import React, { useState, useRef, useEffect } from 'react';
import type { Workspace } from '@common/types';

import ConfirmDialog from './ConfirmDialog';

interface WorkspaceTabBarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onTabClick: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onReorderWorkspaces?: (ids: string[]) => void;
}

const WorkspaceTabBar: React.FC<WorkspaceTabBarProps> = ({
  workspaces,
  activeWorkspaceId,
  onTabClick,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onReorderWorkspaces,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragSourceId = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Electronネイティブメニューからのイベントリスナー
  useEffect(() => {
    const cleanups = [
      window.electronAPI.onWorkspaceTabMenuRename((workspaceId) => {
        const ws = workspaces.find((w) => w.id === workspaceId);
        if (ws) {
          setEditName(ws.displayName);
          setEditingId(ws.id);
        }
      }),
      window.electronAPI.onWorkspaceTabMenuDelete((workspaceId) => {
        setDeleteConfirmId(workspaceId);
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [workspaces]);

  const handleDoubleClick = (ws: Workspace) => {
    setEditName(ws.displayName);
    setEditingId(ws.id);
  };

  const handleSaveEdit = () => {
    if (editingId !== null && editName.trim()) {
      const ws = workspaces.find((w) => w.id === editingId);
      if (ws && editName.trim() !== ws.displayName) {
        onRenameWorkspace(editingId, editName.trim());
      }
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleContextMenu = (e: React.MouseEvent, ws: Workspace) => {
    e.preventDefault();
    const canDelete = workspaces.length > 1;
    window.electronAPI.showWorkspaceTabContextMenu(ws.id, canDelete);
  };

  const handleAddWorkspace = () => {
    const name = `ワークスペース ${workspaces.length + 1}`;
    onCreateWorkspace(name);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      onDeleteWorkspace(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (tabBarRef.current) {
      tabBarRef.current.scrollLeft += e.deltaY;
    }
  };

  // D&D handlers
  const handleDragStart = (e: React.DragEvent, wsId: string) => {
    if (editingId) return;
    dragSourceId.current = wsId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', wsId);
  };

  const handleDragOver = (e: React.DragEvent, wsId: string) => {
    if (!dragSourceId.current || dragSourceId.current === wsId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(wsId);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = dragSourceId.current;
    dragSourceId.current = null;

    if (!sourceId || sourceId === targetId || !onReorderWorkspaces) return;

    const ids = workspaces.map((w) => w.id);
    const sourceIndex = ids.indexOf(sourceId);
    const targetIndex = ids.indexOf(targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    ids.splice(sourceIndex, 1);
    ids.splice(targetIndex, 0, sourceId);
    onReorderWorkspaces(ids);
  };

  const handleDragEnd = () => {
    dragSourceId.current = null;
    setDragOverId(null);
  };

  const deleteTargetWs = deleteConfirmId ? workspaces.find((w) => w.id === deleteConfirmId) : null;

  return (
    <>
      <div className="tab-bar workspace-tab-bar" ref={tabBarRef} onWheel={handleWheel}>
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;

          return (
            <button
              key={ws.id}
              className={`tab-button ${isActive ? 'active' : ''} ${dragOverId === ws.id ? 'drag-over' : ''}`}
              onClick={() => onTabClick(ws.id)}
              onDoubleClick={() => handleDoubleClick(ws)}
              onContextMenu={(e) => handleContextMenu(e, ws)}
              title={ws.displayName}
              draggable={editingId !== ws.id}
              onDragStart={(e) => handleDragStart(e, ws.id)}
              onDragOver={(e) => handleDragOver(e, ws.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, ws.id)}
              onDragEnd={handleDragEnd}
            >
              {editingId === ws.id ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  onBlur={handleSaveEdit}
                  onClick={(e) => e.stopPropagation()}
                  className="tab-name-input"
                />
              ) : (
                ws.displayName
              )}
            </button>
          );
        })}
        <button
          className="tab-button workspace-add-tab-btn"
          onClick={handleAddWorkspace}
          title="新しいワークスペースを追加"
        >
          +
        </button>
      </div>
      <ConfirmDialog
        isOpen={deleteConfirmId !== null && deleteTargetWs !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleConfirmDelete}
        title="ワークスペースの削除"
        message={`ワークスペース「${deleteTargetWs?.displayName}」を削除しますか？\n所属するグループとアイテムも全て削除されます。`}
        confirmText="削除"
        cancelText="キャンセル"
        danger={true}
      />
    </>
  );
};

export default WorkspaceTabBar;
