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

/** 設定画面「ウィンドウ」の切り離しウィンドウの節: 表示する場所 */
const AdminSettingsWindowDetached: React.FC<AdminSettingsWindowDetachedProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="settings-section">
      <h3>{t('settings.detached.heading')}</h3>
      <div className="setting-item">
        <label>{t('settings.detached.position')}</label>
        <div className="position-options">
          {DETACHED_POSITION_OPTIONS.map((value) => (
            <label key={value} className="position-option">
              <input
                type="radio"
                name="detachedPositionMode"
                value={value}
                checked={editedSettings.detachedPositionMode === value}
                onChange={() => handleSettingChange('detachedPositionMode', value)}
                disabled={isLoading}
              />
              <div className="option-content">
                <div className="option-title">{t(`settings.detached.${value}`)}</div>
                <div className="option-description">
                  {t(`settings.detached.${value}Description`)}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsWindowDetached;
