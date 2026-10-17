import React from 'react';
import { useTranslation } from 'react-i18next';
import { MAIN_WINDOW_DISPLAY_INDEX } from '@common/types';
import type { AppSettings, DisplayInfo } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';

interface AdminSettingsWindowWorkspaceProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  displays: DisplayInfo[];
}

/**
 * 設定画面「ウィンドウ」のワークスペースウィンドウの節: 置くディスプレイと端
 * 「最後に動かした場所に出す」（fixed）は詳しい設定にあり、オンの間はここを使わない
 */
const AdminSettingsWindowWorkspace: React.FC<AdminSettingsWindowWorkspaceProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  displays,
}) => {
  const { t } = useTranslation();
  const mode = editedSettings.workspacePositionMode;
  const isFixed = mode === 'fixed';
  // 左端か（古い値 primaryLeft も左端として扱う）
  const isLeftEdge = mode === 'displayLeft' || mode === 'primaryLeft';
  const disabled = isLoading || isFixed;

  // 配置先の番号のディスプレイが今は無い（外した後など）。実際はプライマリに出ているので、選択欄でそう示す
  const isMissingTargetDisplay =
    displays.length > 0 &&
    editedSettings.workspaceTargetDisplayIndex !== MAIN_WINDOW_DISPLAY_INDEX &&
    !displays.some((d) => d.index === editedSettings.workspaceTargetDisplayIndex);

  return (
    <div className="settings-section">
      <h3>{t('settings.workspace.heading')}</h3>
      <div className="setting-item">
        <label>{t('settings.workspace.position')}</label>
        <div className="display-edge-options">
          <label className="edge-option">
            {t('settings.workspace.displayLabel')}
            <select
              className="display-select"
              value={editedSettings.workspaceTargetDisplayIndex}
              onChange={(e) =>
                handleSettingChange('workspaceTargetDisplayIndex', parseInt(e.target.value))
              }
              disabled={disabled}
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
          </label>
          <div className="edge-radio-group">
            <span>{t('settings.workspace.edgeLabel')}</span>
            <label className="edge-option">
              <input
                type="radio"
                name="displayEdgeSide"
                value="displayRight"
                checked={!isFixed && !isLeftEdge}
                onChange={() => handleSettingChange('workspacePositionMode', 'displayRight')}
                disabled={disabled}
              />
              {t('settings.workspace.rightEdge')}
            </label>
            <label className="edge-option">
              <input
                type="radio"
                name="displayEdgeSide"
                value="displayLeft"
                checked={!isFixed && isLeftEdge}
                onChange={() => handleSettingChange('workspacePositionMode', 'displayLeft')}
                disabled={disabled}
              />
              {t('settings.workspace.leftEdge')}
            </label>
          </div>
        </div>
        {isFixed && (
          <div className="setting-description">{t('settings.workspace.fixedActive')}</div>
        )}
      </div>
    </div>
  );
};

export default AdminSettingsWindowWorkspace;
