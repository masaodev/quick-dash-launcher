import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AppSettings } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';

type WindowSizeKey = 'windowWidth' | 'windowHeight' | 'editModeWidth' | 'editModeHeight';

const WINDOW_SIZE_GROUPS: Array<{
  title: 'launcher' | 'admin';
  fields: Array<{ label: 'width' | 'height'; min: number; max: number; key: WindowSizeKey }>;
}> = [
  {
    title: 'launcher',
    fields: [
      { label: 'width', min: 400, max: 2000, key: 'windowWidth' },
      { label: 'height', min: 300, max: 1200, key: 'windowHeight' },
    ],
  },
  {
    title: 'admin',
    fields: [
      { label: 'width', min: 800, max: 2000, key: 'editModeWidth' },
      { label: 'height', min: 600, max: 1200, key: 'editModeHeight' },
    ],
  },
];

/** チェックボックスの設定（文言は settings.windowDetails.<文言キー>・<文言キー>Description） */
type ToggleKey =
  'workspaceVisibleOnAllDesktops' | 'detachedVisibleOnAllDesktops' | 'windowSnapEnabled';

type ToggleText = 'workspaceVisibleOnAllDesktops' | 'detachedVisibleOnAllDesktops' | 'windowSnap';

const DESKTOP_TOGGLES: Array<{ key: ToggleKey; text: ToggleText }> = [
  { key: 'workspaceVisibleOnAllDesktops', text: 'workspaceVisibleOnAllDesktops' },
  { key: 'detachedVisibleOnAllDesktops', text: 'detachedVisibleOnAllDesktops' },
];

interface AdminSettingsWindowDetailsProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  handleNumberInputChange: <K extends keyof AppSettings>(key: K, value: string) => void;
  handleNumberInputBlur: () => Promise<void>;
}

/**
 * 設定画面「ウィンドウ」の詳しい設定（既定は畳んでおく）
 * 大きさ・ワークスペースを最後に動かした場所に出す・見た目・仮想デスクトップ・吸着
 */
const AdminSettingsWindowDetails: React.FC<AdminSettingsWindowDetailsProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  handleNumberInputChange,
  handleNumberInputBlur,
}) => {
  const { t } = useTranslation();
  const isWorkspaceFixed = editedSettings.workspacePositionMode === 'fixed';
  // 背景だけを透明にしている間は、不透明度は 100% 扱いで効かない
  const isOpacityDisabled = editedSettings.workspaceBackgroundTransparent;

  const renderToggle = (key: ToggleKey, text: ToggleText) => (
    <div key={key} className="setting-item">
      <label>
        <input
          type="checkbox"
          checked={editedSettings[key]}
          onChange={(e) => handleSettingChange(key, e.target.checked)}
          disabled={isLoading}
        />
        {t(`settings.windowDetails.${text}`)}
      </label>
      <div className="setting-description">{t(`settings.windowDetails.${text}Description`)}</div>
    </div>
  );

  return (
    <details className="settings-section settings-details">
      <summary>{t('settings.windowDetails.summary')}</summary>

      <h4>{t('settings.windowSize.heading')}</h4>
      <div className="window-size-grid">
        {WINDOW_SIZE_GROUPS.map(({ title, fields }) => (
          <div key={title} className="window-size-group">
            <div className="window-size-group-title">{t(`settings.windowSize.${title}`)}</div>
            <div className="window-size-inputs">
              {fields.map(({ label, min, max, key }) => (
                <div key={key} className="window-size-field">
                  <label htmlFor={key}>{t(`settings.windowSize.${label}`)}</label>
                  <input
                    id={key}
                    type="number"
                    min={min}
                    max={max}
                    value={editedSettings[key]}
                    onChange={(e) => handleNumberInputChange(key, e.target.value)}
                    onBlur={handleNumberInputBlur}
                    disabled={isLoading}
                  />
                  <span className="unit">px</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h4>{t('settings.windowDetails.workspacePlacement')}</h4>
      <div className="setting-item">
        <label>
          <input
            type="checkbox"
            checked={isWorkspaceFixed}
            onChange={(e) =>
              handleSettingChange(
                'workspacePositionMode',
                e.target.checked ? 'fixed' : 'displayRight'
              )
            }
            disabled={isLoading}
          />
          {t('settings.windowDetails.workspaceFixed')}
        </label>
        <div className="setting-description">
          {t('settings.windowDetails.workspaceFixedDescription')}
        </div>
      </div>

      <h4>{t('settings.windowDetails.appearance')}</h4>
      <div className="setting-item">
        <label>
          <input
            type="checkbox"
            checked={editedSettings.workspaceBackgroundTransparent}
            onChange={(e) =>
              handleSettingChange('workspaceBackgroundTransparent', e.target.checked)
            }
            disabled={isLoading}
          />
          {t('settings.windowDetails.backgroundTransparent')}
        </label>
        <div className="setting-description">
          {t('settings.windowDetails.backgroundTransparentDescription')}
        </div>
      </div>
      <div className="setting-item">
        <label htmlFor="workspaceOpacity">{t('settings.windowDetails.opacity')}</label>
        <div className="opacity-control">
          <input
            id="workspaceOpacity"
            type="range"
            min="0"
            max="100"
            value={editedSettings.workspaceOpacity}
            onChange={(e) => handleSettingChange('workspaceOpacity', parseInt(e.target.value))}
            disabled={isLoading || isOpacityDisabled}
            className="opacity-slider"
          />
          <span className="opacity-value">{editedSettings.workspaceOpacity}%</span>
        </div>
        <div className="setting-description">
          {isOpacityDisabled
            ? t('settings.windowDetails.opacityDisabled')
            : t('settings.windowDetails.opacityDescription')}
        </div>
      </div>

      <h4>{t('settings.windowDetails.virtualDesktops')}</h4>
      {DESKTOP_TOGGLES.map(({ key, text }) => renderToggle(key, text))}
      {renderToggle('windowSnapEnabled', 'windowSnap')}
    </details>
  );
};

export default AdminSettingsWindowDetails;
