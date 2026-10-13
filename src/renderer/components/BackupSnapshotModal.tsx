import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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

const BackupSnapshotModal: React.FC<BackupSnapshotModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
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
    }
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
    failMessage: (error: string | undefined) => string,
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
        setMessage(failMessage(result.error));
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
      t('settings.snapshots.restored'),
      (error) => t('settings.snapshots.restoreFailed', { error: error ?? '' }),
      t('settings.snapshots.restoreError')
    );

  const handleDelete = () =>
    executeSnapshotAction(
      () => window.electronAPI.backupAPI.deleteSnapshot(selectedTimestamp!),
      t('settings.snapshots.deleted'),
      (error) => t('settings.snapshots.deleteFailed', { error: error ?? '' }),
      t('settings.snapshots.deleteError'),
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
          <h2>{t('settings.snapshots.title')}</h2>
          <span className="backup-snapshot-count">
            {t('settings.snapshots.count', { count: snapshots.length })}
          </span>
        </div>

        {message && <div className="backup-snapshot-message">{message}</div>}

        <div className="backup-snapshot-list">
          {isLoading && snapshots.length === 0 && (
            <div className="loading">{t('common.loading')}</div>
          )}

          {!isLoading && snapshots.length === 0 && (
            <div className="backup-snapshot-empty">{t('settings.snapshots.empty')}</div>
          )}

          {snapshots.map((snapshot) => (
            <div
              key={snapshot.timestamp}
              className={`backup-snapshot-item ${selectedTimestamp === snapshot.timestamp ? 'selected' : ''}`}
              onClick={() => setSelectedTimestamp(snapshot.timestamp)}
            >
              <div className="backup-snapshot-item-main">
                <span className="backup-snapshot-date">
                  {new Date(snapshot.createdAt).toLocaleString(i18n.language)}
                </span>
                <span className="backup-snapshot-timestamp">{snapshot.timestamp}</span>
              </div>
              <div className="backup-snapshot-item-meta">
                <span>{t('settings.snapshots.fileCount', { count: snapshot.fileCount })}</span>
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
            {t('settings.snapshots.delete')}
          </Button>
          <Button
            variant="primary"
            onClick={() => setConfirmAction('restore')}
            disabled={!selectedTimestamp || isLoading}
          >
            {t('settings.snapshots.restore')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>

        <ConfirmDialog
          isOpen={confirmAction === 'restore'}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleRestore}
          title={t('settings.snapshots.restoreTitle')}
          message={t('settings.snapshots.restoreConfirm', { timestamp: selectedTimestamp ?? '' })}
          confirmText={t('settings.snapshots.restoreConfirmButton')}
          cancelText={t('common.cancel')}
        />

        <ConfirmDialog
          isOpen={confirmAction === 'delete'}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleDelete}
          title={t('settings.snapshots.deleteTitle')}
          message={t('settings.snapshots.deleteConfirm', { timestamp: selectedTimestamp ?? '' })}
          confirmText={t('settings.snapshots.deleteConfirmButton')}
          cancelText={t('common.cancel')}
          danger
        />
      </div>
    </div>
  );
};

export default BackupSnapshotModal;
