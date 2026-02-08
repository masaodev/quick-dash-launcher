import React, { useEffect, useState } from 'react';
import type { ArchivedWorkspaceGroup } from '@common/types';

import { logError } from '../utils/debug';
import { useToast } from '../hooks/useToast';

import AdminArchiveCard from './AdminArchiveCard';

const AdminArchiveTab: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [archivedGroups, setArchivedGroups] = useState<ArchivedWorkspaceGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // アーカイブされたグループを読み込む
  const loadArchivedGroups = async () => {
    try {
      setLoading(true);
      const groups = await window.electronAPI.workspaceAPI.loadArchivedGroups();
      // ArchivedWorkspaceGroup型として扱う
      setArchivedGroups(groups as ArchivedWorkspaceGroup[]);
    } catch (error) {
      logError('Failed to load archived groups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchivedGroups();

    // ワークスペース変更イベントをリッスン（アーカイブ・復元・削除時に再読み込み）
    const cleanup = window.electronAPI.onWorkspaceChanged(() => {
      loadArchivedGroups();
    });

    return cleanup;
  }, []);

  /**
   * グループを復元
   */
  const handleRestore = async (groupId: string) => {
    try {
      await window.electronAPI.workspaceAPI.restoreGroup(groupId);
      showSuccess('グループを復元しました');
      // onWorkspaceChangedイベントで自動的に再読み込みされる
    } catch (error) {
      logError('Failed to restore group:', error);
      showError('グループの復元に失敗しました');
    }
  };

  /**
   * グループを完全削除
   */
  const handleDelete = async (groupId: string, groupName: string) => {
    const confirmed = confirm(
      `「${groupName}」をアーカイブから完全に削除しますか？\n\nこの操作は取り消せません。`
    );

    if (!confirmed) return;

    try {
      await window.electronAPI.workspaceAPI.deleteArchivedGroup(groupId);
      showSuccess('グループを削除しました');
      // onWorkspaceChangedイベントで自動的に再読み込みされる
    } catch (error) {
      logError('Failed to delete archived group:', error);
      showError('グループの削除に失敗しました');
    }
  };

  // 日付の新しい順にソート
  const sortedGroups = [...archivedGroups].sort((a, b) => b.archivedAt - a.archivedAt);

  return (
    <div className="archive-tab">
      <div className="archive-content">
        <div className="archive-header">
          <h2>📦 アーカイブ</h2>
          <p className="archive-description">
            ワークスペースからアーカイブしたグループの一覧です。ワークスペースに復元するか、完全に削除できます。
          </p>
        </div>

        {loading ? (
          <div className="archive-loading">読み込み中...</div>
        ) : sortedGroups.length === 0 ? (
          <div className="archive-empty">
            <p>アーカイブされたワークスペースグループはありません</p>
          </div>
        ) : (
          <div className="archived-groups-list">
            {sortedGroups.map((group) => (
              <AdminArchiveCard
                key={group.id}
                group={group}
                onRestore={handleRestore}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminArchiveTab;
