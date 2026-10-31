import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings, BackupStatus } from '@common/types';
import { SETTING_NUMBER_RANGES } from '@common/settingRanges';

import type { HandleSettingChange } from '../hooks/useSettingsManager';
import { useDataImport } from '../hooks/useDataImport';
import { useToast } from '../hooks/useToast';
import { logError } from '../utils/debug';

import { Button } from './ui';
import BackupSnapshotModal from './BackupSnapshotModal';
import DataImportConfirmDialog from './DataImportConfirmDialog';
import SettingsSectionHeader, { type SectionResetProps } from './SettingsSectionHeader';

interface AdminSettingsBackupSectionProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  handleNumberInputChange: <K extends keyof AppSettings>(key: K, value: string) => void;
  handleNumberInputBlur: () => Promise<void>;
  sectionReset: SectionResetProps;
}

/** 設定画面「バックアップ」: 自動バックアップの設定とスナップショット一覧、データの書き出し */
const AdminSettingsBackupSection: React.FC<AdminSettingsBackupSectionProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  handleNumberInputChange,
  handleNumberInputBlur,
  sectionReset,
}) => {
  const { t, i18n } = useTranslation();
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { showSuccess, showWarning, showInfo } = useToast();
  const dataImport = useDataImport({ onProblem: showWarning, onApplied: showInfo });

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

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      const result = await window.electronAPI.backupAPI.exportAll();
      if (!result) return;
      showSuccess(
        t('settings.backup.exported', { count: result.fileCount, path: result.filePath }),
        { long: true }
      );
    } catch (error) {
      logError('データの書き出しに失敗:', error);
      showWarning(
        t('settings.backup.exportFailed', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="settings-section">
        <SettingsSectionHeader
          title={t('settings.backup.heading')}
          section="backup"
          editedSettings={editedSettings}
          isLoading={isLoading}
          {...sectionReset}
        />
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
                min={SETTING_NUMBER_RANGES.backupRetention.min}
                max={SETTING_NUMBER_RANGES.backupRetention.max}
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
                className="setting-item-button"
                onClick={() => setShowSnapshotModal(true)}
                disabled={isLoading}
              >
                {t('settings.backup.openSnapshots')}
              </Button>
            </div>
          </>
        )}

        <BackupSnapshotModal
          isOpen={showSnapshotModal}
          onClose={() => setShowSnapshotModal(false)}
        />
      </div>

      {/* 書き出しはバックアップ機能のオン・オフに関係なく使える */}
      <div className="settings-section">
        <h3>{t('settings.backup.transferHeading')}</h3>
        <p className="settings-section-description">{t('settings.backup.transferDescription')}</p>
        <div className="setting-item">
          <Button
            variant="secondary"
            className="setting-item-button"
            onClick={handleExportAll}
            disabled={isLoading || isExporting}
            data-testid="export-all-data"
          >
            {t('settings.backup.exportAll')}
          </Button>
          <Button
            variant="secondary"
            className="setting-item-button"
            onClick={dataImport.start}
            disabled={isLoading || dataImport.isBusy}
            data-testid="import-data"
          >
            {t('dataImport.button')}
          </Button>
        </div>
      </div>

      <DataImportConfirmDialog
        summary={dataImport.pending?.summary ?? null}
        onConfirm={dataImport.confirm}
        onClose={dataImport.cancel}
      />
    </>
  );
};

export default AdminSettingsBackupSection;
