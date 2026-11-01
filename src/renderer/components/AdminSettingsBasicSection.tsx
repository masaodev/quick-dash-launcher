import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings, AutoLaunchStatus } from '@common/types';
import { LANGUAGE_SETTINGS, isLanguageSetting } from '@common/i18n/languages';

import type { HandleSettingChange } from '../hooks/useSettingsManager';

import { HotkeyInput } from './HotkeyInput';
import SettingsSectionHeader, { type SectionResetProps } from './SettingsSectionHeader';

interface AdminSettingsBasicSectionProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  hotkeyValidation: { isValid: boolean; reason?: string };
  onHotkeyValidation: (isValid: boolean, reason?: string) => void;
  onItemSearchHotkeyChange: (hotkey: string) => void;
  showConfirm: (
    message: string,
    options?: { title?: string; confirmText?: string; cancelText?: string; danger?: boolean }
  ) => Promise<boolean>;
  sectionReset: SectionResetProps;
}

/** 設定画面「基本設定」: 言語・起動ホットキー・システム・表示・グループ起動 */
const AdminSettingsBasicSection: React.FC<AdminSettingsBasicSectionProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  hotkeyValidation,
  onHotkeyValidation,
  onItemSearchHotkeyChange,
  showConfirm,
  sectionReset,
}) => {
  const { t } = useTranslation();
  // 更新の知らせは Store 版では使わない（Store が更新する）ので、設定も出さない
  const [isStore, setIsStore] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void window.electronAPI.getAppInfo().then((info) => {
      if (!cancelled) setIsStore(info.distribution === 'store');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // タブが複数あるときに「複数タブを表示」をオフにするなら、最初のタブだけになると先に知らせる
  const handleDataFileTabsChange = async (checked: boolean): Promise<void> => {
    const tabs = editedSettings.dataFileTabs || [];
    if (!checked && tabs.length > 1) {
      const first =
        tabs.find((tab) => tab.files.includes(editedSettings.defaultFileTab ?? '')) ?? tabs[0];
      const ok = await showConfirm(
        t('settings.display.dataFileTabsOffConfirm', { name: first.name }),
        {
          title: t('settings.display.dataFileTabsOffTitle'),
          confirmText: t('settings.display.dataFileTabsOffButton'),
          cancelText: t('common.cancel'),
        }
      );
      if (!ok) return;
    }
    handleSettingChange('showDataFileTabs', checked);
  };
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
        <SettingsSectionHeader
          title={t('settings.system.heading')}
          section="system"
          editedSettings={editedSettings}
          isLoading={isLoading}
          {...sectionReset}
        />
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
        {!isStore && (
          <>
            <div className="setting-item">
              <label>
                <input
                  type="checkbox"
                  checked={editedSettings.updateCheckEnabled}
                  onChange={(e) => handleSettingChange('updateCheckEnabled', e.target.checked)}
                  disabled={isLoading}
                />
                {t('settings.system.updateCheck')}
              </label>
              <div className="setting-description">
                {t('settings.system.updateCheckDescription')}
              </div>
            </div>
            <div className="setting-item setting-item-child">
              <label>
                <input
                  type="checkbox"
                  checked={editedSettings.updateCheckIncludeBeta}
                  onChange={(e) => handleSettingChange('updateCheckIncludeBeta', e.target.checked)}
                  disabled={isLoading || !editedSettings.updateCheckEnabled}
                />
                {t('settings.system.updateCheckIncludeBeta')}
              </label>
              <div className="setting-description">
                {t('settings.system.updateCheckIncludeBetaDescription')}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="settings-section">
        <SettingsSectionHeader
          title={t('settings.display.heading')}
          section="display"
          editedSettings={editedSettings}
          isLoading={isLoading}
          {...sectionReset}
        />
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
              onChange={(e) => void handleDataFileTabsChange(e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.display.dataFileTabs')}
          </label>
          <div className="setting-description">{t('settings.display.dataFileTabsDescription')}</div>
        </div>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.recordLaunchUsage}
              onChange={(e) => handleSettingChange('recordLaunchUsage', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.system.recordLaunchUsage')}
          </label>
          <div className="setting-description">
            {t('settings.system.recordLaunchUsageDescription')}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <SettingsSectionHeader
          title={t('settings.search.heading')}
          section="search"
          editedSettings={editedSettings}
          isLoading={isLoading}
          {...sectionReset}
        />
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.searchMemo ?? false}
              onChange={(e) => handleSettingChange('searchMemo', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.display.searchMemo')}
          </label>
        </div>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.searchIgnoreWidth ?? false}
              onChange={(e) => handleSettingChange('searchIgnoreWidth', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.display.searchIgnoreWidth')}
          </label>
          <div className="setting-description">
            {t('settings.display.searchIgnoreWidthDescription')}
          </div>
        </div>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.searchIgnoreKana ?? false}
              onChange={(e) => handleSettingChange('searchIgnoreKana', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.display.searchIgnoreKana')}
          </label>
          <div className="setting-description">
            {t('settings.display.searchIgnoreKanaDescription')}
          </div>
        </div>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.searchSortByUsage ?? false}
              onChange={(e) => handleSettingChange('searchSortByUsage', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.display.searchSortByUsage')}
          </label>
          <div className="setting-description">
            {t('settings.display.searchSortByUsageDescription')}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <SettingsSectionHeader
          title={t('settings.cli.heading')}
          section="cli"
          editedSettings={editedSettings}
          isLoading={isLoading}
          {...sectionReset}
        />
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
    </>
  );
};

export default AdminSettingsBasicSection;
