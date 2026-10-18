import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';

import WindowSizeFields from './WindowSizeFields';

interface AdminSettingsWindowOtherProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  handleNumberInputChange: <K extends keyof AppSettings>(key: K, value: string) => void;
  handleNumberInputBlur: () => Promise<void>;
}

/** 設定画面「ウィンドウ」のその他の節: 2 つ以上のウィンドウに効く吸着と、管理ウィンドウの大きさ */
const AdminSettingsWindowOther: React.FC<AdminSettingsWindowOtherProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  handleNumberInputChange,
  handleNumberInputBlur,
}) => {
  const { t } = useTranslation();

  return (
    <div className="settings-section">
      <h3>{t('settings.windowOther.heading')}</h3>
      <div className="settings-form">
        <span className="settings-form-label settings-form-label-top">
          {t('settings.windowOther.snap')}
        </span>
        <div className="settings-form-stack">
          <label className="settings-form-check">
            <input
              type="checkbox"
              checked={editedSettings.windowSnapEnabled}
              onChange={(e) => handleSettingChange('windowSnapEnabled', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.windowOther.windowSnap')}
          </label>
          <span className="field-description">
            {t('settings.windowOther.windowSnapDescription')}
          </span>
        </div>

        <div className="settings-form-divider" />
        <span className="settings-form-label">{t('settings.windowOther.adminWindowSize')}</span>
        <WindowSizeFields
          widthKey="editModeWidth"
          heightKey="editModeHeight"
          widthRange={[800, 2000]}
          heightRange={[600, 1200]}
          editedSettings={editedSettings}
          isLoading={isLoading}
          handleNumberInputChange={handleNumberInputChange}
          handleNumberInputBlur={handleNumberInputBlur}
        />
      </div>
    </div>
  );
};

export default AdminSettingsWindowOther;
