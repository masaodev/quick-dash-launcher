import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings, WindowPositionMode } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';

import WindowSizeFields from './WindowSizeFields';

/** メインウィンドウの表示する場所の選択肢（文言は settings.windowPosition.<値>・<値>Description） */
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
}

/** 設定画面「ウィンドウ」のメインウィンドウの節: 表示する場所・大きさ */
const AdminSettingsWindowMain: React.FC<AdminSettingsWindowMainProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  handleNumberInputChange,
  handleNumberInputBlur,
}) => {
  const { t } = useTranslation();
  const mode = editedSettings.windowPositionMode;

  return (
    <div className="settings-section">
      <h3>{t('settings.windowPosition.heading')}</h3>
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
      </div>
    </div>
  );
};

export default AdminSettingsWindowMain;
