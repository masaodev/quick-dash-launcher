import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings, WindowPositionMode } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';
import type { ConfirmOptions } from '../hooks/useDialogManager';

import WindowSizeFields from './WindowSizeFields';
import SettingsSectionHeader, { type SectionResetProps } from './SettingsSectionHeader';

/** ランチャーの表示する場所の選択肢（文言は settings.windowPosition.<値>・<値>Description） */
const WINDOW_POSITION_OPTIONS: readonly WindowPositionMode[] = [
  'cursorMonitorCenter',
  'cursor',
  'center',
  'fixed',
];

interface AdminSettingsWindowMainProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  handleNumberInputChange: <K extends keyof AppSettings>(key: K, value: string) => void;
  handleNumberInputBlur: () => Promise<void>;
  showConfirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  sectionReset: SectionResetProps;
}

/** 設定画面「ウィンドウ」のランチャーの節: 表示する場所・大きさ・見た目（操作のヒント・タブ） */
const AdminSettingsWindowMain: React.FC<AdminSettingsWindowMainProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  handleNumberInputChange,
  handleNumberInputBlur,
  showConfirm,
  sectionReset,
}) => {
  const { t } = useTranslation();
  const mode = editedSettings.windowPositionMode;

  // タブが複数あるときに「タブを表示する」をオフにするなら、最初のタブだけになると先に知らせる
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

  return (
    <div className="settings-section">
      <SettingsSectionHeader
        title={t('settings.windowPosition.heading')}
        section="mainWindow"
        editedSettings={editedSettings}
        isLoading={isLoading}
        {...sectionReset}
      />
      <div className="settings-form">
        <label className="settings-form-label" htmlFor="windowPositionMode">
          {t('settings.windowPosition.label')}
        </label>
        <div className="settings-form-line">
          <select
            id="windowPositionMode"
            value={mode}
            onChange={(e) =>
              handleSettingChange('windowPositionMode', e.target.value as WindowPositionMode)
            }
            disabled={isLoading}
          >
            {WINDOW_POSITION_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`settings.windowPosition.${value}`)}
              </option>
            ))}
          </select>
          <span className="field-description">
            {t(`settings.windowPosition.${mode}Description`)}
          </span>
        </div>

        <div className="settings-form-divider" />
        <span className="settings-form-label">{t('settings.windowSize.heading')}</span>
        <WindowSizeFields
          widthKey="windowWidth"
          heightKey="windowHeight"
          editedSettings={editedSettings}
          isLoading={isLoading}
          handleNumberInputChange={handleNumberInputChange}
          handleNumberInputBlur={handleNumberInputBlur}
        />

        <div className="settings-form-divider" />
        <span className="settings-form-label settings-form-label-top">
          {t('settings.windowPosition.appearance')}
        </span>
        <div className="settings-form-stack">
          <label className="settings-form-check">
            <input
              type="checkbox"
              checked={editedSettings.showKeyboardHints}
              onChange={(e) => handleSettingChange('showKeyboardHints', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.display.keyboardHints')}
          </label>
          <span className="field-description">
            {t('settings.display.keyboardHintsDescription')}
          </span>
          <label className="settings-form-check">
            <input
              type="checkbox"
              checked={editedSettings.showDataFileTabs}
              onChange={(e) => void handleDataFileTabsChange(e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.display.dataFileTabs')}
          </label>
          <span className="field-description">{t('settings.display.dataFileTabsDescription')}</span>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsWindowMain;
