import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings, DetachedPositionMode } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';

/** 切り離しウィンドウの表示する場所の選択肢（文言は settings.detached.<値>・<値>Description） */
const DETACHED_POSITION_OPTIONS: readonly DetachedPositionMode[] = ['mainDisplay', 'saved'];

interface AdminSettingsWindowDetachedProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
}

/** 設定画面「ウィンドウ」の切り離しウィンドウの節: 表示する場所・仮想デスクトップ */
const AdminSettingsWindowDetached: React.FC<AdminSettingsWindowDetachedProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
}) => {
  const { t } = useTranslation();
  const mode = editedSettings.detachedPositionMode;

  return (
    <div className="settings-section">
      <h3>{t('settings.detached.heading')}</h3>
      <div className="settings-form">
        <label className="settings-form-label" htmlFor="detachedPositionMode">
          {t('settings.detached.position')}
        </label>
        <div className="settings-form-line">
          <select
            id="detachedPositionMode"
            value={mode}
            onChange={(e) =>
              handleSettingChange('detachedPositionMode', e.target.value as DetachedPositionMode)
            }
            disabled={isLoading}
          >
            {DETACHED_POSITION_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`settings.detached.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <span />
        <span className="field-description">{t(`settings.detached.${mode}Description`)}</span>

        <div className="settings-form-divider" />
        <span className="settings-form-label">{t('settings.detached.virtualDesktops')}</span>
        <label className="settings-form-check">
          <input
            type="checkbox"
            checked={editedSettings.detachedVisibleOnAllDesktops}
            onChange={(e) => handleSettingChange('detachedVisibleOnAllDesktops', e.target.checked)}
            disabled={isLoading}
          />
          {t('settings.detached.visibleOnAllDesktops')}
        </label>
      </div>
    </div>
  );
};

export default AdminSettingsWindowDetached;
