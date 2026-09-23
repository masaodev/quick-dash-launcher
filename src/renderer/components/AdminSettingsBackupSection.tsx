import React, { useEffect, useState } from 'react';
import type { AppSettings, BackupStatus } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';

import { Button } from './ui';
import BackupSnapshotModal from './BackupSnapshotModal';

interface AdminSettingsBackupSectionProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  handleNumberInputChange: <K extends keyof AppSettings>(key: K, value: string) => void;
  handleNumberInputBlur: () => Promise<void>;
}

/** 設定画面「バックアップ」: 自動バックアップの設定とスナップショット一覧 */
const AdminSettingsBackupSection: React.FC<AdminSettingsBackupSectionProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  handleNumberInputChange,
  handleNumberInputBlur,
}) => {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);

  // 表示時と、スナップショット一覧（復元・削除で件数が変わる）の開閉時に状態を取り直す
  useEffect(() => {
    const loadBackupStatus = async () => {
      try {
        setBackupStatus(await window.electronAPI.backupAPI.getStatus());
      } catch (error) {
        console.error('バックアップ状態の取得に失敗:', error);
      }
    };
    loadBackupStatus();
  }, [showSnapshotModal]);

  return (
    <div className="settings-section">
      <h3>バックアップ</h3>
      <p className="settings-section-description">
        アプリ起動時に1日1回、データファイル・設定ファイルをスナップショットとしてバックアップします。
      </p>
      <div className="setting-item">
        <label>
          <input
            type="checkbox"
            checked={editedSettings.backupEnabled}
            onChange={(e) => handleSettingChange('backupEnabled', e.target.checked)}
            disabled={isLoading}
          />
          バックアップ機能を有効にする
        </label>
      </div>

      {editedSettings.backupEnabled && (
        <>
          <div className="setting-item indent">
            <label htmlFor="backupRetention">バックアップ保存件数:</label>
            <input
              id="backupRetention"
              type="number"
              min="3"
              max="50"
              value={editedSettings.backupRetention}
              onChange={(e) => handleNumberInputChange('backupRetention', e.target.value)}
              onBlur={handleNumberInputBlur}
              disabled={isLoading}
            />
            <span className="unit">件</span>
          </div>

          <div className="setting-item indent">
            <label>
              <input
                type="checkbox"
                checked={editedSettings.backupIncludeClipboard}
                onChange={(e) => handleSettingChange('backupIncludeClipboard', e.target.checked)}
                disabled={isLoading}
              />
              クリップボードデータもバックアップに含める
            </label>
            <div className="setting-description">
              クリップボードデータは容量が大きくなる可能性があります。
            </div>
          </div>

          {backupStatus && (
            <div className="setting-item indent">
              <div className="backup-status-info">
                <span>スナップショット: {backupStatus.snapshotCount} 件</span>
                <span>
                  最終バックアップ:{' '}
                  {backupStatus.lastBackupTime
                    ? new Date(backupStatus.lastBackupTime).toLocaleString('ja-JP')
                    : 'なし'}
                </span>
              </div>
            </div>
          )}

          <div className="setting-item indent">
            <Button variant="info" onClick={() => setShowSnapshotModal(true)} disabled={isLoading}>
              スナップショット一覧
            </Button>
          </div>
        </>
      )}

      <BackupSnapshotModal isOpen={showSnapshotModal} onClose={() => setShowSnapshotModal(false)} />
    </div>
  );
};

export default AdminSettingsBackupSection;
