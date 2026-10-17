import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings, AutoLaunchStatus } from '@common/types';
import { LANGUAGE_SETTINGS, isLanguageSetting } from '@common/i18n/languages';

import type { HandleSettingChange } from '../hooks/useSettingsManager';

import { HotkeyInput } from './HotkeyInput';

interface AdminSettingsBasicSectionProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  hotkeyValidation: { isValid: boolean; reason?: string };
  onHotkeyValidation: (isValid: boolean, reason?: string) => void;
  onItemSearchHotkeyChange: (hotkey: string) => void;
}

/** 設定画面「基本設定」: 言語・起動ホットキー・システム・表示・グループ起動 */
const AdminSettingsBasicSection: React.FC<AdminSettingsBasicSectionProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  hotkeyValidation,
  onHotkeyValidation,
  onItemSearchHotkeyChange,
}) => {
  const { t } = useTranslation();
  // アイテム検索ホットキーのバリデーション状態
  const [itemSearchHotkeyValidation, setItemSearchHotkeyValidation] = useState<{
    isValid: boolean;
    reason?: string;
  }>({ isValid: true });

  // OS 側の自動起動の状態（Store 版で、設定と Windows 側の状態が食い違うときに案内する）
  // 保存が終わった後（設定の変更通知）と、Windows の設定から戻ってきたとき（フォーカス）に読み直す
  const [autoLaunchStatus, setAutoLaunchStatus] = useState<AutoLaunchStatus | null>(null);
  useEffect(() => {
    const loadStatus = () => {
      window.electronAPI
        .getAutoLaunchStatus()
        .then(setAutoLaunchStatus)
        .catch(() => setAutoLaunchStatus(null));
    };
    loadStatus();
    window.addEventListener('focus', loadStatus);
    const unsubscribe = window.electronAPI.onSettingsChanged(loadStatus);
    return () => {
      window.removeEventListener('focus', loadStatus);
      unsubscribe();
    };
  }, []);
  const storeState = autoLaunchStatus?.mode === 'store' ? autoLaunchStatus.state : null;
  const blockedByWindows =
    editedSettings.autoLaunch &&
    (storeState === 'disabledByUser' || storeState === 'disabledByPolicy');
  const enabledByWindows =
    !editedSettings.autoLaunch && (storeState === 'enabled' || storeState === 'enabledByPolicy');

  return (
    <>
      <div className="settings-section">
        <h3>{t('settings.language.heading')}</h3>
        <div className="setting-item">
          <label htmlFor="language">{t('settings.language.label')}</label>
          <select
            id="language"
            className="select-base"
            value={editedSettings.language}
            onChange={(e) => {
              if (isLanguageSetting(e.target.value)) {
                handleSettingChange('language', e.target.value);
              }
            }}
            disabled={isLoading}
          >
            {LANGUAGE_SETTINGS.map((value) => (
              <option key={value} value={value}>
                {t(`settings.language.options.${value}`)}
              </option>
            ))}
          </select>
          <div className="setting-description">{t('settings.language.description')}</div>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t('settings.hotkeys.heading')}</h3>
        <div className="setting-item">
          <label htmlFor="hotkey">{t('settings.hotkeys.launcher')}</label>
          <HotkeyInput
            value={editedSettings.hotkey}
            onChange={(hotkey) => handleSettingChange('hotkey', hotkey)}
            onValidationChange={onHotkeyValidation}
            disabled={isLoading}
            placeholder="Alt+Space"
          />
          {!hotkeyValidation.isValid && (
            <div className="validation-error">{hotkeyValidation.reason}</div>
          )}
        </div>
        <div className="setting-item">
          <label htmlFor="itemSearchHotkey">{t('settings.hotkeys.windowSearch')}</label>
          <HotkeyInput
            value={editedSettings.itemSearchHotkey || ''}
            onChange={onItemSearchHotkeyChange}
            onValidationChange={(isValid, reason) =>
              setItemSearchHotkeyValidation({ isValid, reason })
            }
            disabled={isLoading}
            placeholder={t('settings.hotkeys.windowSearchPlaceholder')}
            allowEmpty={true}
            showClearButton={true}
          />
          {!itemSearchHotkeyValidation.isValid && (
            <div className="validation-error">{itemSearchHotkeyValidation.reason}</div>
          )}
          <div className="setting-description">{t('settings.hotkeys.windowSearchDescription')}</div>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t('settings.system.heading')}</h3>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.autoLaunch}
              onChange={(e) => handleSettingChange('autoLaunch', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.system.autoLaunch')}
          </label>
          {blockedByWindows && (
            <div className="validation-error">
              {storeState === 'disabledByPolicy'
                ? t('settings.system.autoLaunchBlockedByPolicy')
                : t('settings.system.autoLaunchBlockedByWindows')}
            </div>
          )}
          {enabledByWindows && (
            <div className="setting-description">
              {storeState === 'enabledByPolicy'
                ? t('settings.system.autoLaunchEnabledByPolicy')
                : t('settings.system.autoLaunchEnabledByWindows')}
            </div>
          )}
        </div>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.cliEnabled}
              onChange={(e) => handleSettingChange('cliEnabled', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.system.cli')}
          </label>
          <div className="setting-description">{t('settings.system.cliDescription')}</div>
        </div>
      </div>

      <div className="settings-section">
        <h3>{t('settings.display.heading')}</h3>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.showKeyboardHints}
              onChange={(e) => handleSettingChange('showKeyboardHints', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.display.keyboardHints')}
          </label>
          <div className="setting-description">
            {t('settings.display.keyboardHintsDescription')}
          </div>
        </div>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.showDataFileTabs}
              onChange={(e) => handleSettingChange('showDataFileTabs', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.display.dataFileTabs')}
          </label>
          <div className="setting-description">{t('settings.display.dataFileTabsDescription')}</div>
        </div>
      </div>
    </>
  );
};

export default AdminSettingsBasicSection;
