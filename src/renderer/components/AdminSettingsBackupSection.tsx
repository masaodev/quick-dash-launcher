import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings, BackupStatus } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';
import { logError } from '../utils/debug';

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
  const { t, i18n } = useTranslation();
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);

  // 表示時と、スナップショット一覧（復元・削除で件数が変わる）の開閉時に状態を取り直す
  useEffect(() => {
    const loadBackupStatus = async () => {
      try {
        setBackupStatus(await window.electronAPI.backupAPI.getStatus());
      } catch (error) {
        logError('バックアップ状態の取得に失敗:', error);
      }
    };
    loadBackupStatus();
  }, [showSnapshotModal]);

  return (
    <div className="settings-section">
      <h3>{t('settings.backup.heading')}</h3>
      <p className="settings-section-description">{t('settings.backup.description')}</p>
      <div className="setting-item">
        <label>
          <input
            type="checkbox"
            checked={editedSettings.backupEnabled}
            onChange={(e) => handleSettingChange('backupEnabled', e.target.checked)}
            disabled={isLoading}
          />
          {t('settings.backup.enabled')}
        </label>
      </div>

      {editedSettings.backupEnabled && (
        <>
          <div className="setting-item indent">
            <label htmlFor="backupRetention">{t('settings.backup.retention')}</label>
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
            <span className="unit">{t('settings.backup.retentionUnit')}</span>
          </div>

          <div className="setting-item indent">
            <label>
              <input
                type="checkbox"
                checked={editedSettings.backupIncludeClipboard}
                onChange={(e) => handleSettingChange('backupIncludeClipboard', e.target.checked)}
                disabled={isLoading}
              />
              {t('settings.backup.includeClipboard')}
            </label>
            <div className="setting-description">
              {t('settings.backup.includeClipboardDescription')}
            </div>
          </div>

          {backupStatus && (
            <div className="setting-item indent">
              <div className="backup-status-info">
                <span>
                  {t('settings.backup.snapshotCount', { count: backupStatus.snapshotCount })}
                </span>
                <span>
                  {t('settings.backup.lastBackup', {
                    time: backupStatus.lastBackupTime
                      ? new Date(backupStatus.lastBackupTime).toLocaleString(i18n.language)
                      : t('settings.backup.neverBackedUp'),
                  })}
                </span>
              </div>
            </div>
          )}

          <div className="setting-item indent">
            <Button
              variant="secondary"
              onClick={() => setShowSnapshotModal(true)}
              disabled={isLoading}
            >
              {t('settings.backup.openSnapshots')}
            </Button>
          </div>
        </>
      )}

      <BackupSnapshotModal isOpen={showSnapshotModal} onClose={() => setShowSnapshotModal(false)} />
    </div>
  );
};

export default AdminSettingsBackupSection;
