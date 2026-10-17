import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Workspace } from '@common/types';

import { useTabBarScroll } from '../hooks/useTabBarScroll';
import { isCommitEnter, resolveInlineName } from '../utils/inlineName';

import ConfirmDialog from './ConfirmDialog';

interface WorkspaceTabBarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onTabClick: (workspaceId: string) => void;
  onCreateWorkspace: (name: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onReorderWorkspaces?: (ids: string[]) => void;
  isArchiveActive?: boolean;
  onArchiveClick?: () => void;
}

const WorkspaceTabBar: React.FC<WorkspaceTabBarProps> = ({
  workspaces,
  activeWorkspaceId,
  onTabClick,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onReorderWorkspaces,
  isArchiveActive,
  onArchiveClick,
}) => {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragSourceId = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { tabBarRef, handleWheel } = useTabBarScroll(
    isArchiveActive ? 'archive' : activeWorkspaceId
  );
  // タブが収まらないとき、続きがある側の端をぼかす（スクロールバーは隠しているので、続きがあると分かるように）
  const [overflow, setOverflow] = useState({ left: false, right: false });

  const updateOverflow = () => {
    const el = tabBarRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setOverflow((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  };

  // ウィンドウの幅が変わったら測り直す
  useEffect(() => {
    const el = tabBarRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // タブの数・名前・名前の編集・選んだタブ（見える位置まで動く）が変わったら測り直す
  useEffect(() => {
    updateOverflow();
  });

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
    const ws = workspaces.find((w) => w.id === editingId);
    const name = ws ? resolveInlineName(editName, ws.displayName) : null;
    if (ws && name) {
      onRenameWorkspace(ws.id, name);
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (isCommitEnter(e)) {
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
    const name = t('workspace.tabs.defaultName', { number: workspaces.length + 1 });
    onCreateWorkspace(name);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      onDeleteWorkspace(deleteConfirmId);
      setDeleteConfirmId(null);
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
      <div className="tab-bar workspace-tab-bar">
        <div
          className={`workspace-tab-scroll${overflow.left ? ' fade-left' : ''}${overflow.right ? ' fade-right' : ''}`}
          ref={tabBarRef}
          onWheel={handleWheel}
          onScroll={updateOverflow}
        >
          {workspaces.map((ws) => {
            const isActive = !isArchiveActive && ws.id === activeWorkspaceId;

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
                  <span className="workspace-tab-name">{ws.displayName}</span>
                )}
              </button>
            );
          })}
        </div>
        {onArchiveClick && (
          <button
            className={`tab-button archive-tab ${isArchiveActive ? 'active' : ''}`}
            onClick={onArchiveClick}
            title={t('workspace.tabs.archive')}
          >
            🗄️
          </button>
        )}
        <button
          className="tab-button workspace-add-tab-btn"
          onClick={handleAddWorkspace}
          title={t('workspace.tabs.add')}
        >
          +
        </button>
      </div>
      <ConfirmDialog
        isOpen={deleteConfirmId !== null && deleteTargetWs !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleConfirmDelete}
        title={t('workspace.tabs.deleteTitle')}
        message={t('workspace.tabs.deleteConfirm', { name: deleteTargetWs?.displayName ?? '' })}
        confirmText={t('workspace.tabs.delete')}
        cancelText={t('common.cancel')}

        danger={true}
      />
    </>
  );
};

export default WorkspaceTabBar;
