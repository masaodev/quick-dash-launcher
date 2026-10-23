import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceItem } from '@common/types';
import { describeWorkspaceItem } from '@common/utils/workspaceConverters';

import { getDefaultIconForItem } from '../utils/itemTypeIcons';
import { setEntriesSummary } from '../utils/setEditing';
import { isCommitEnter, resolveInlineName } from '../utils/inlineName';

type ItemDropZone = 'before' | 'after';

interface WorkspaceItemCardProps {
  item: WorkspaceItem;
  isEditing: boolean;
  draggedElement?: { id: string; kind: 'item' | 'group' } | null;
  onLaunch: (item: WorkspaceItem) => void;
  onRemove: (id: string) => void;
  onUpdateDisplayName: (id: string, displayName: string) => void;
  onStartEdit: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, dropZone?: ItemDropZone) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  /** id からワークスペースのアイテムの名前を引く（セットのツールチップに行の名前を出す） */
  nameOfItem?: (itemId: string) => string | undefined;
}

const WorkspaceItemCard: React.FC<WorkspaceItemCardProps> = ({
  item,
  isEditing,
  draggedElement,
  onLaunch,
  onRemove,
  onUpdateDisplayName,
  onStartEdit,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onContextMenu,
  nameOfItem,
}) => {
  const { t, i18n } = useTranslation();
  const [editValue, setEditValue] = useState(item.displayName);
  const [dropZone, setDropZone] = useState<ItemDropZone | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // ドラッグ終了時にゾーンをクリア
  useEffect(() => {
    if (!draggedElement) {
      setDropZone(null);
    }
  }, [draggedElement]);

  function calculateDropZone(e: React.DragEvent): ItemDropZone | null {
    if (!draggedElement || draggedElement.id === item.id) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = (e.clientY - rect.top) / rect.height;
    return relativeY < 0.5 ? 'before' : 'after';
  }

  function handleDragOver(e: React.DragEvent): void {
    onDragOver(e);
    setDropZone(calculateDropZone(e));
  }

  function handleDragLeave(): void {
    setDropZone(null);
  }

  function handleDrop(e: React.DragEvent): void {
    const currentDropZone = dropZone;
    setDropZone(null);
    onDrop(e, currentDropZone ?? undefined);
  }

  const handleClick = () => {
    if (!isEditing) {
      onLaunch(item);
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(item.id);
  };

  // Enter とフォーカスを外したときで同じ扱い（空・変更なしなら元の名前に戻す）。
  // 参照でワークスペースでの表示名があるときは、空にするとそれを消してメインウィンドウの表示名に戻す
  const commitEdit = () => {
    const name = resolveInlineName(editValue, item.displayName);
    if (name) {
      onUpdateDisplayName(item.id, name);
    } else if (item.ref?.alias !== undefined && editValue.trim() === '') {
      onUpdateDisplayName(item.id, '');
    } else {
      setEditValue(item.displayName);
      onStartEdit(); // 編集モード終了
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCommitEnter(e)) {
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditValue(item.displayName);
      onStartEdit(); // 編集モード終了
    }
  };

  const getTooltipText = (): string => {
    const lines: string[] = [];
    // 参照は、どのメインウィンドウのアイテムを指しているかを先頭に出す（カードには右下の矢印だけ）
    if (item.type === 'ref') {
      lines.push(
        t('workspace.ref.tooltipMissing', {
          reason: describeWorkspaceItem(item, t),
          name: item.ref.lastKnownName ?? item.displayName,
        }),
        t('workspace.ref.tooltipMissingHint')
      );
      return lines.join('\n');
    }
    if (item.ref) {
      lines.push(t('workspace.ref.tooltipMain', { name: item.ref.mainDisplayName ?? '' }));
      if (item.ref.tabName) lines.push(t('workspace.ref.tooltipTab', { tab: item.ref.tabName }));
    }
    lines.push(describeWorkspaceItem(item, t));
    if (item.type === 'set') {
      const summary = setEntriesSummary(item.entries, nameOfItem ?? (() => undefined));
      if (summary) lines.push(summary);
    }

    if (item.type === 'item') {
      if (item.originalPath) {
        lines.push(t('workspace.itemCard.linkTarget', { path: item.originalPath }));
      }
      if (item.args) {
        lines.push(t('workspace.itemCard.args', { args: item.args }));
      }
    }
    if (item.memo) {
      lines.push(t('workspace.itemCard.note', { note: item.memo }));
    }

    lines.push('');

    const addedDate = new Date(item.addedAt).toLocaleString(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    lines.push(t('workspace.itemCard.addedAt', { date: addedDate }));

    return lines.join('\n');
  };

  return (
    <div
      className={`workspace-item-card${item.type === 'ref' ? ' workspace-item-card-missing' : ''}`}
      data-drop-zone={dropZone || undefined}
      data-ref={item.ref ? item.ref.status : undefined}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      title={getTooltipText()}
    >
      <div className="workspace-item-content">
        {item.icon ? (
          <img src={item.icon} alt="" className="workspace-item-icon" />
        ) : (
          <div className="workspace-item-icon-placeholder">{getDefaultIconForItem(item)}</div>
        )}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="workspace-item-name-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commitEdit}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="workspace-item-name">{item.displayName}</div>
        )}
      </div>
      {item.ref?.status === 'ok' && <span className="workspace-item-ref-mark" aria-hidden="true" />}
      <button
        className="workspace-item-delete-btn"
        onClick={handleRemoveClick}
        title={t('workspace.itemCard.remove')}
      >
        ×
      </button>
    </div>
  );
};

export default WorkspaceItemCard;
