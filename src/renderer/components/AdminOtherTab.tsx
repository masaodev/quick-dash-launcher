import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppInfo, UpdateCheckStatus } from '@common/types';

import ConfirmDialog from './ConfirmDialog';
import { Button } from './ui';

/** ショートカット一覧の固定のキー（説明は辞書の help.keys） */
const FIXED_SHORTCUTS = [
  { keys: 'Ctrl+E', text: 'toggleAdmin' },
  { keys: 'Ctrl+W', text: 'toggleWorkspace' },
  { keys: 'Enter', text: 'open' },
  { keys: 'Shift+Enter', text: 'openFolder' },
  { keys: 'Ctrl+Shift+Enter', text: 'runAsAdmin' },
  { keys: 'F2', text: 'edit' },
  { keys: '↑/↓', text: 'select' },
  { keys: 'Ctrl+↑/↓', text: 'history' },
  { keys: 'Tab', text: 'switchTab' },
  { keys: 'Shift+Tab', text: 'switchMode' },
  { keys: 'F5', text: 'reload' },
  { keys: 'Esc', text: 'close' },
] as const;

const AdminOtherTab: React.FC = () => {
  const { t } = useTranslation();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [quitConfirmOpen, setQuitConfirmOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateCheckStatus | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  // 「今すぐ確かめる」を押したあとだけ「最新の版です」を出す（開いただけでは出さない）
  const [checkedByUser, setCheckedByUser] = useState(false);
  const [hotkeys, setHotkeys] = useState<{ launch: string; itemSearch: string }>({
    launch: '',
    itemSearch: '',
  });

  useEffect(() => {
    const loadAppInfo = async () => {
      const info = await window.electronAPI.getAppInfo();
      setAppInfo(info);
    };
    loadAppInfo();
  }, []);

  // 更新の知らせの状態（設定を切り替えたら読み直す）
  useEffect(() => {
    const loadUpdateStatus = async () => {
      setUpdateStatus(await window.electronAPI.getUpdateStatus());
    };
    void loadUpdateStatus();
    return window.electronAPI.onSettingsChanged(loadUpdateStatus);
  }, []);

  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      setUpdateStatus(await window.electronAPI.checkForUpdates());
      setCheckedByUser(true);
    } finally {
      setCheckingUpdate(false);
    }
  };

  // ショートカット一覧のホットキーは設定の値を表示する（設定が変わったら読み直す）
  useEffect(() => {
    const loadHotkeys = async () => {
      const settings = await window.electronAPI.getSettings();
      setHotkeys({ launch: settings.hotkey, itemSearch: settings.itemSearchHotkey });
    };
    loadHotkeys();
    return window.electronAPI.onSettingsChanged(loadHotkeys);
  }, []);

  const handleOpenConfigFolder = () => {
    window.electronAPI.openConfigFolder();
  };

  const handleQuitApp = () => {
    setQuitConfirmOpen(true);
  };

  const handleOpenGitHub = () => {
    if (appInfo?.repository) {
      window.electronAPI.openExternalUrl(appInfo.repository);
    }
  };

  return (
    <div className="admin-other-tab">
      <div className="help-content">
        {/* キーボードショートカット - 最上部に大きく表示 */}
        <div className="help-section help-section-shortcuts">
          <h3>{t('help.shortcuts')}</h3>
          <div className="shortcuts-grid">
            <div className="shortcut-item">
              <kbd>{hotkeys.launch ? hotkeys.launch : t('help.notSet')}</kbd>
              <span>{t('help.keys.toggleLauncher')}</span>
            </div>
            {hotkeys.itemSearch && (
              <div className="shortcut-item">
                <kbd>{hotkeys.itemSearch}</kbd>
                <span>{t('help.keys.windowSearch')}</span>
              </div>
            )}
            {FIXED_SHORTCUTS.map(({ keys, text }) => (
              <div key={keys} className="shortcut-item">
                <kbd>{keys}</kbd>
                <span>{t(`help.keys.${text}`)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2カラムエリア */}
        <div className="help-cards">
          {/* アプリについて */}
          <div className="help-card">
            <h3>{t('help.about')}</h3>
            <div className="help-card-content">
              <div className="app-info-details">
                <div className="app-info-item">
                  <span className="app-info-label">{t('help.version')}</span>
                  <span className="app-info-value">{appInfo?.version || t('help.loading')}</span>
                </div>
                <div className="app-info-item">
                  <span className="app-info-label">{t('help.distribution')}</span>
                  <span className="app-info-value">
                    {appInfo ? t(`help.distributions.${appInfo.distribution}`) : t('help.loading')}
                  </span>
                </div>
                {appInfo?.distribution === 'portable' && (
                  <div className="app-info-item">
                    <span className="app-info-label">{t('help.dataLocation')}</span>
                    <span className="app-info-value">
                      {t(
                        appInfo.portableData
                          ? 'help.dataLocations.portable'
                          : 'help.dataLocations.appData'
                      )}
                    </span>
                  </div>
                )}
                {updateStatus?.supported && (
                  <div className="app-info-update" data-testid="help-update-status">
                    {updateStatus.available ? (
                      <>
                        <span className="app-info-update-available">
                          {t('help.updateAvailable', { version: updateStatus.available.version })}
                        </span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            updateStatus.available &&
                            window.electronAPI.openExternalUrl(updateStatus.available.url)
                          }
                        >
                          {t('help.openReleasePage')}
                        </Button>
                      </>
                    ) : !updateStatus.enabled ? (
                      <span className="app-info-update-note">{t('help.updateCheckOff')}</span>
                    ) : checkingUpdate ? (
                      <span className="app-info-update-note">{t('help.checkingForUpdates')}</span>
                    ) : updateStatus.failed && checkedByUser ? (
                      <span className="app-info-update-note">{t('help.updateCheckFailed')}</span>
                    ) : checkedByUser ? (
                      <span className="app-info-update-note">{t('help.upToDate')}</span>
                    ) : null}
                    {updateStatus.enabled && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleCheckForUpdates}
                        disabled={checkingUpdate}
                      >
                        {t('help.checkForUpdates')}
                      </Button>
                    )}
                    {updateStatus.lastCheckedAt !== null && (
                      <span className="app-info-update-note">
                        {t('help.updateLastChecked', {
                          date: new Date(updateStatus.lastCheckedAt).toLocaleString(),
                        })}
                      </span>
                    )}
                  </div>
                )}
                <div className="app-info-item">
                  <span className="app-info-label">{t('help.license')}</span>
                  <span className="app-info-value">{appInfo?.license || t('help.loading')}</span>
                </div>
              </div>
              <Button variant="secondary" onClick={handleOpenGitHub} disabled={!appInfo}>
                🔗 GitHub
              </Button>
            </div>
          </div>

          {/* データ管理 */}
          <div className="help-card">
            <h3>{t('help.data')}</h3>
            <div className="help-card-content">
              <p className="help-card-description">{t('help.dataDescription')}</p>
              <Button variant="secondary" onClick={handleOpenConfigFolder}>
                {t('help.openSettingsFolder')}
              </Button>
              <p className="help-card-description">{t('help.cliNote')}</p>
            </div>
          </div>
        </div>

        {/* 終了ボタン - 下部に分離 */}
        <div className="help-footer">
          <Button variant="danger" onClick={handleQuitApp}>
            {t('help.quit')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={quitConfirmOpen}
        onClose={() => setQuitConfirmOpen(false)}
        onConfirm={() => {
          setQuitConfirmOpen(false);
          window.electronAPI.quitApp();
        }}
        message={t('help.quitConfirm')}
        confirmText={t('help.quitConfirmButton')}
        danger
      />
    </div>
  );
};

export default AdminOtherTab;
