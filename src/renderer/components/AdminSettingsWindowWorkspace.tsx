import React from 'react';
import { useTranslation } from 'react-i18next';
import { MAIN_WINDOW_DISPLAY_INDEX } from '@common/types';
import type { AppSettings, DisplayInfo, WorkspacePositionMode } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';

/** 表示する場所の選択肢（値と、文言 settings.workspace.<文言キー>・<文言キー>Description） */
const POSITION_OPTIONS = [
  { value: 'displayRight', text: 'rightEdge' },
  { value: 'displayLeft', text: 'leftEdge' },
  { value: 'fixed', text: 'fixed' },
] as const satisfies ReadonlyArray<{ value: WorkspacePositionMode; text: string }>;

type PositionOption = (typeof POSITION_OPTIONS)[number];

/** 古い値（primaryLeft・primaryRight）も、選択肢のどれかに読み替える */
function toPositionOption(mode: WorkspacePositionMode): PositionOption {
  if (mode === 'primaryLeft') return POSITION_OPTIONS[1];
  if (mode === 'primaryRight') return POSITION_OPTIONS[0];
  return POSITION_OPTIONS.find((o) => o.value === mode) ?? POSITION_OPTIONS[0];
}

interface AdminSettingsWindowWorkspaceProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  displays: DisplayInfo[];
}

/**
 * 設定画面「ウィンドウ」のワークスペースウィンドウの節: 表示する場所（端とディスプレイ）・見た目・仮想デスクトップ
 * 「最後に置いた場所」（fixed）の間は、ディスプレイの選択欄を使わない（理由を説明の下に出す）
 */
const AdminSettingsWindowWorkspace: React.FC<AdminSettingsWindowWorkspaceProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  displays,
}) => {
  const { t } = useTranslation();
  const position = toPositionOption(editedSettings.workspacePositionMode);
  const isFixed = position.value === 'fixed';
  // 背景だけを透明にしている間は、不透明度は 100% 扱いで効かない
  const isOpacityDisabled = editedSettings.workspaceBackgroundTransparent;

  // 配置先の番号のディスプレイが今は無い（外した後など）。実際はプライマリに出ているので、選択欄でそう示す
  const isMissingTargetDisplay =
    displays.length > 0 &&
    editedSettings.workspaceTargetDisplayIndex !== MAIN_WINDOW_DISPLAY_INDEX &&
    !displays.some((d) => d.index === editedSettings.workspaceTargetDisplayIndex);

  return (
    <div className="settings-section">
      <h3>{t('settings.workspace.heading')}</h3>
      <div className="settings-form">
        <label className="settings-form-label" htmlFor="workspacePositionMode">
          {t('settings.workspace.position')}
        </label>
        <div className="settings-form-line">
          <select
            id="workspacePositionMode"
            value={position.value}
            onChange={(e) =>
              handleSettingChange('workspacePositionMode', e.target.value as WorkspacePositionMode)
            }
            disabled={isLoading}
          >
            {POSITION_OPTIONS.map(({ value, text }) => (
              <option key={value} value={value}>
                {t(`settings.workspace.${text}`)}
              </option>
            ))}
          </select>
          <span className="settings-form-field">
            <label htmlFor="workspaceTargetDisplayIndex">
              {t('settings.workspace.displayLabel')}
            </label>
            <select
              id="workspaceTargetDisplayIndex"
              value={editedSettings.workspaceTargetDisplayIndex}
              onChange={(e) =>
                handleSettingChange('workspaceTargetDisplayIndex', parseInt(e.target.value))
              }
              disabled={isLoading || isFixed}
            >
              <option value={MAIN_WINDOW_DISPLAY_INDEX}>
                {t('settings.workspace.mainWindowDisplay')}
              </option>
              {displays.map((display) => (
                <option key={display.index} value={display.index}>
                  {display.label}
                </option>
              ))}
              {isMissingTargetDisplay && (
                <option value={editedSettings.workspaceTargetDisplayIndex}>
                  {t('settings.workspace.missingDisplay', {
                    number: editedSettings.workspaceTargetDisplayIndex + 1,
                  })}
                </option>
              )}
            </select>
          </span>
        </div>
        <span />
        <span className="field-description">
          {t(`settings.workspace.${position.text}Description`)}
        </span>
        {isFixed && (
          <>
            <span />
            <span className="field-description">{t('settings.workspace.displayDisabled')}</span>
          </>
        )}

        <div className="settings-form-divider" />
        <span className="settings-form-label settings-form-label-top">
          {t('settings.workspace.appearance')}
        </span>
        <div className="settings-form-stack">
          <label className="settings-form-check">
            <input
              type="checkbox"
              checked={editedSettings.workspaceBackgroundTransparent}
              onChange={(e) =>
                handleSettingChange('workspaceBackgroundTransparent', e.target.checked)
              }
              disabled={isLoading}
            />
            {t('settings.workspace.backgroundTransparent')}
          </label>
          <span className="field-description">
            {t('settings.workspace.backgroundTransparentDescription')}
          </span>
          <div className="settings-form-line">
            <label htmlFor="workspaceOpacity">{t('settings.workspace.opacity')}</label>
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
          </div>
          <span className="field-description">
            {isOpacityDisabled
              ? t('settings.workspace.opacityDisabled')
              : t('settings.workspace.opacityDescription')}
          </span>
        </div>

        <span className="settings-form-label">{t('settings.workspace.virtualDesktops')}</span>
        <label className="settings-form-check">
          <input
            type="checkbox"
            checked={editedSettings.workspaceVisibleOnAllDesktops}
            onChange={(e) => handleSettingChange('workspaceVisibleOnAllDesktops', e.target.checked)}
            disabled={isLoading}
          />
          {t('settings.workspace.visibleOnAllDesktops')}
        </label>
      </div>
    </div>
  );
};

export default AdminSettingsWindowWorkspace;
