import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { SnapshotInfo } from '@common/types';

import '../styles/components/Modal.css';
import '../styles/components/BackupSnapshotModal.css';
import { Button } from './ui';
import ConfirmDialog from './ConfirmDialog';

interface BackupSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}/${m}/${day} ${h}:${min}:${sec}`;
}

const BackupSnapshotModal: React.FC<BackupSnapshotModalProps> = ({ isOpen, onClose }) => {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'restore' | 'delete' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const loadSnapshots = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await window.electronAPI.backupAPI.listSnapshots();
      setSnapshots(list);
    } catch (error) {
      console.error('スナップショット一覧の取得に失敗:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
      setSelectedTimestamp(null);
      setMessage(null);
      window.electronAPI.setModalMode(true, { width: 700, height: 600 });
    }

    return () => {
      if (isOpen) {
        window.electronAPI.setModalMode(false);
      }
    };
  }, [isOpen, loadSnapshots]);

  useEffect(() => {
    if (!isOpen) return;

    modalRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (confirmAction) {
          setConfirmAction(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, confirmAction]);

  const executeSnapshotAction = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    successMessage: string,
    failPrefix: string,
    errorMessage: string,
    clearSelection = false
  ) => {
    if (!selectedTimestamp) return;
    setConfirmAction(null);
    setIsLoading(true);
    setMessage(null);

    try {
      const result = await action();
      if (result.success) {
        setMessage(successMessage);
        if (clearSelection) setSelectedTimestamp(null);
      } else {
        setMessage(`${failPrefix}: ${result.error}`);
      }
    } catch (error) {
      setMessage(errorMessage);
      console.error(error);
    } finally {
      setIsLoading(false);
      await loadSnapshots();
    }
  };

  const handleRestore = () =>
    executeSnapshotAction(
      () => window.electronAPI.backupAPI.restoreSnapshot(selectedTimestamp!),
      'リストアが完了しました。設定を反映するためにアプリの再起動を推奨します。',
      'リストアに失敗しました',
      'リストア中にエラーが発生しました'
    );

  const handleDelete = () =>
    executeSnapshotAction(
      () => window.electronAPI.backupAPI.deleteSnapshot(selectedTimestamp!),
      'スナップショットを削除しました',
      '削除に失敗しました',
      '削除中にエラーが発生しました',
      true
    );

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content backup-snapshot-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="backup-snapshot-header">
          <h2>スナップショット一覧</h2>
          <span className="backup-snapshot-count">{snapshots.length} 件</span>
        </div>

        {message && <div className="backup-snapshot-message">{message}</div>}

        <div className="backup-snapshot-list">
          {isLoading && snapshots.length === 0 && <div className="loading">読み込み中...</div>}

          {!isLoading && snapshots.length === 0 && (
            <div className="backup-snapshot-empty">スナップショットはありません</div>
          )}

          {snapshots.map((snapshot) => (
            <div
              key={snapshot.timestamp}
              className={`backup-snapshot-item ${selectedTimestamp === snapshot.timestamp ? 'selected' : ''}`}
              onClick={() => setSelectedTimestamp(snapshot.timestamp)}
            >
              <div className="backup-snapshot-item-main">
                <span className="backup-snapshot-date">{formatDate(snapshot.createdAt)}</span>
                <span className="backup-snapshot-timestamp">{snapshot.timestamp}</span>
              </div>
              <div className="backup-snapshot-item-meta">
                <span>{snapshot.fileCount} ファイル</span>
                <span>{formatSize(snapshot.totalSize)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <Button
            variant="danger"
            onClick={() => setConfirmAction('delete')}
            disabled={!selectedTimestamp || isLoading}
          >
            削除
          </Button>
          <Button
            variant="primary"
            onClick={() => setConfirmAction('restore')}
            disabled={!selectedTimestamp || isLoading}
          >
            復元
          </Button>
          <Button variant="cancel" onClick={onClose}>
            閉じる
          </Button>
        </div>

        <ConfirmDialog
          isOpen={confirmAction === 'restore'}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleRestore}
          title="スナップショットの復元"
          message={`選択したスナップショット（${selectedTimestamp}）からデータを復元します。復元前に現在の状態が自動バックアップされます。続行しますか？`}
          confirmText="復元する"
          cancelText="キャンセル"
        />

        <ConfirmDialog
          isOpen={confirmAction === 'delete'}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleDelete}
          title="スナップショットの削除"
          message={`選択したスナップショット（${selectedTimestamp}）を削除します。この操作は元に戻せません。`}
          confirmText="削除する"
          cancelText="キャンセル"
          danger
        />
      </div>
    </div>
  );
};

export default BackupSnapshotModal;
