import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings, WindowPositionMode } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';

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
}

/** 設定画面「ウィンドウ」のメインウィンドウの節: 表示する場所 */
const AdminSettingsWindowMain: React.FC<AdminSettingsWindowMainProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="settings-section">
      <h3>{t('settings.windowPosition.heading')}</h3>
      <div className="setting-item">
        <label>{t('settings.windowPosition.label')}</label>
        <div className="position-options">
          {WINDOW_POSITION_OPTIONS.map((value) => (
            <label key={value} className="position-option">
              <input
                type="radio"
                name="windowPositionMode"
                value={value}
                checked={editedSettings.windowPositionMode === value}
                onChange={() => handleSettingChange('windowPositionMode', value)}
                disabled={isLoading}
              />
              <div className="option-content">
                <div className="option-title">{t(`settings.windowPosition.${value}`)}</div>
                <div className="option-description">
                  {t(`settings.windowPosition.${value}Description`)}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsWindowMain;
