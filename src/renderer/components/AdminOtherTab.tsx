import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppInfo } from '@common/types';

import { Button } from './ui/Button';

/** 設定のホットキー（"Alt+Space"）を表示用（"Alt + Space"）にする */
function formatHotkey(hotkey: string): string {
  return hotkey.split('+').join(' + ');
}

/** ショートカット一覧の固定のキー（説明は辞書の help.keys） */
const FIXED_SHORTCUTS = [
  { keys: 'Ctrl + E', text: 'toggleAdmin' },
  { keys: 'Ctrl + W', text: 'toggleWorkspace' },
  { keys: 'Enter', text: 'open' },
  { keys: 'Shift + Enter', text: 'openFolder' },
  { keys: '↑ / ↓', text: 'select' },
  { keys: 'Tab', text: 'switchTab' },
  { keys: 'Shift + Tab', text: 'switchMode' },
  { keys: 'F5', text: 'reload' },
  { keys: 'Esc', text: 'close' },
] as const;

const AdminOtherTab: React.FC = () => {
  const { t } = useTranslation();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
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
    if (confirm(t('help.quitConfirm'))) {
      window.electronAPI.quitApp();
    }
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
              <kbd>{hotkeys.launch ? formatHotkey(hotkeys.launch) : t('help.notSet')}</kbd>
              <span>{t('help.keys.toggleLauncher')}</span>
            </div>
            {hotkeys.itemSearch && (
              <div className="shortcut-item">
                <kbd>{formatHotkey(hotkeys.itemSearch)}</kbd>
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
                <div className="app-info-item">
                  <span className="app-info-label">{t('help.license')}</span>
                  <span className="app-info-value">{appInfo?.license || t('help.loading')}</span>
                </div>
              </div>
              <Button variant="info" onClick={handleOpenGitHub} disabled={!appInfo}>
                🔗 GitHub
              </Button>
            </div>
          </div>

          {/* データ管理 */}
          <div className="help-card">
            <h3>{t('help.data')}</h3>
            <div className="help-card-content">
              <p className="help-card-description">{t('help.dataDescription')}</p>
              <Button variant="info" onClick={handleOpenConfigFolder}>
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
    </div>
  );
};

export default AdminOtherTab;
