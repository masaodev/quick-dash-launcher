import React from 'react';
import type { ArchivedWorkspaceGroup } from '@common/types';

interface ArchivedGroupCardProps {
  group: ArchivedWorkspaceGroup;
  onRestore: (groupId: string) => void;
  onDelete: (groupId: string, groupName: string) => void;
}

const AdminArchiveCard: React.FC<ArchivedGroupCardProps> = ({ group, onRestore, onDelete }) => {
  /**
   * タイムスタンプを日時文字列に変換
   */
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="archived-group-card">
      <div
        className="archived-group-color"
        style={{ backgroundColor: group.color || 'var(--color-primary)' }}
      />
      <div className="archived-group-info">
        <h3 className="archived-group-name">{group.name}</h3>
        <div className="archived-group-meta">
          <span className="archived-date">アーカイブ日時: {formatDate(group.archivedAt)}</span>
          <span className="archived-item-count">{group.itemCount}個のアイテム</span>
        </div>
      </div>
      <div className="archived-group-actions">
        <button
          className="archived-group-restore-btn"
          onClick={() => onRestore(group.id)}
          title="グループを復元"
        >
          ↩️ 復元
        </button>
        <button
          className="archived-group-delete-btn"
          onClick={() => onDelete(group.id, group.name)}
          title="アーカイブから完全削除"
        >
          🗑️ 削除
        </button>
      </div>
    </div>
  );
};

export default AdminArchiveCard;
