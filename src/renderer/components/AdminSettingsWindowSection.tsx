import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AppSettings,
  DisplayInfo,
  WindowPositionMode,
  WorkspacePositionMode,
} from '@common/types';

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

/** ウィンドウの表示位置の選択肢（文言は settings.windowPosition.<値>・<値>Description） */
const WINDOW_POSITION_OPTIONS: readonly WindowPositionMode[] = [
  'center',
  'cursorMonitorCenter',
  'cursor',
  'fixed',
];

/** ワークスペースの表示・連動に関するチェックボックス設定（文言は settings.workspace.<文言キー>・<文言キー>Description） */
const WORKSPACE_TOGGLES: Array<{
  key:
    | 'workspaceBackgroundTransparent'
    | 'workspaceVisibleOnAllDesktops'
    | 'detachedVisibleOnAllDesktops'
    | 'windowSnapEnabled';
  text:
    | 'backgroundTransparent'
    | 'visibleOnAllDesktops'
    | 'detachedVisibleOnAllDesktops'
    | 'windowSnap';
}> = [
  { key: 'workspaceBackgroundTransparent', text: 'backgroundTransparent' },
  { key: 'workspaceVisibleOnAllDesktops', text: 'visibleOnAllDesktops' },
  { key: 'detachedVisibleOnAllDesktops', text: 'detachedVisibleOnAllDesktops' },
  { key: 'windowSnapEnabled', text: 'windowSnap' },
];

interface AdminSettingsWindowSectionProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  handleNumberInputChange: <K extends keyof AppSettings>(key: K, value: string) => void;
  handleNumberInputBlur: () => Promise<void>;
}

/** 設定画面「ウィンドウ」: ウィンドウサイズ・表示位置・ワークスペースウィンドウ */
const AdminSettingsWindowSection: React.FC<AdminSettingsWindowSectionProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  handleNumberInputChange,
  handleNumberInputBlur,
}) => {
  const { t } = useTranslation();
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);

  // ディスプレイ一覧を取得（ワークスペースの配置先の選択肢）
  useEffect(() => {
    const loadDisplays = async () => {
      try {
        setDisplays(await window.electronAPI.getDisplays());
      } catch (error) {
        console.error('ディスプレイ一覧の取得に失敗:', error);
      }
    };
    loadDisplays();
  }, []);

  // ディスプレイ端配置モードかどうか（後方互換性のためprimaryLeft/primaryRightも含む）
  const isDisplayEdgeMode =
    editedSettings.workspacePositionMode === 'displayLeft' ||
    editedSettings.workspacePositionMode === 'displayRight' ||
    editedSettings.workspacePositionMode === 'primaryLeft' ||
    editedSettings.workspacePositionMode === 'primaryRight';

  // 左端配置かどうか（後方互換性のためprimaryLeftも含む）
  const isLeftEdge =
    editedSettings.workspacePositionMode === 'displayLeft' ||
    editedSettings.workspacePositionMode === 'primaryLeft';

  return (
    <>
      <div className="settings-section">
        <h3>{t('settings.windowSize.heading')}</h3>
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
      </div>

      <div className="settings-section">
        <h3>{t('settings.windowPosition.heading')}</h3>
        <div className="setting-item">
          <div className="position-options">
            {WINDOW_POSITION_OPTIONS.map((value) => (
              <label key={value} className="position-option">
                <input
                  type="radio"
                  name="windowPositionMode"
                  value={value}
                  checked={editedSettings.windowPositionMode === value}
                  onChange={(e) =>
                    handleSettingChange('windowPositionMode', e.target.value as WindowPositionMode)
                  }
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

      <div className="settings-section">
        <h3>{t('settings.workspace.heading')}</h3>

        {/* 自動表示設定 */}
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.autoShowWorkspace}
              onChange={(e) => handleSettingChange('autoShowWorkspace', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.workspace.autoShow')}
          </label>
          <div className="setting-description">{t('settings.workspace.autoShowDescription')}</div>
        </div>

        {/* 切り離しウィンドウ連動設定 */}
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.hideDetachedWithMainWindow}
              onChange={(e) => handleSettingChange('hideDetachedWithMainWindow', e.target.checked)}
              disabled={isLoading}
            />
            {t('settings.workspace.hideDetached')}
          </label>
          <div className="setting-description">
            {t('settings.workspace.hideDetachedDescription')}
          </div>
        </div>

        {/* 表示位置設定 */}
        <div className="setting-item">
          <label>{t('settings.workspace.position')}</label>
          <div className="position-options">
            <label className="position-option">
              <input
                type="radio"
                name="workspacePositionMode"
                value="displayEdge"
                checked={isDisplayEdgeMode}
                onChange={() => handleSettingChange('workspacePositionMode', 'displayRight')}
                disabled={isLoading}
              />
              <div className="option-content">
                <div className="option-title">{t('settings.workspace.displayEdge')}</div>
                <div className="option-description">
                  {t('settings.workspace.displayEdgeDescription')}
                </div>
                {isDisplayEdgeMode && (
                  <div className="display-edge-options">
                    <select
                      className="display-select"
                      value={editedSettings.workspaceTargetDisplayIndex}
                      onChange={(e) =>
                        handleSettingChange('workspaceTargetDisplayIndex', parseInt(e.target.value))
                      }
                      disabled={isLoading}
                    >
                      {displays.map((display) => (
                        <option key={display.index} value={display.index}>
                          {display.label}
                        </option>
                      ))}
                    </select>
                    <div className="edge-radio-group">
                      <label className="edge-option">
                        <input
                          type="radio"
                          name="displayEdgeSide"
                          value="displayLeft"
                          checked={isLeftEdge}
                          onChange={() =>
                            handleSettingChange('workspacePositionMode', 'displayLeft')
                          }
                          disabled={isLoading}
                        />
                        {t('settings.workspace.leftEdge')}
                      </label>
                      <label className="edge-option">
                        <input
                          type="radio"
                          name="displayEdgeSide"
                          value="displayRight"
                          checked={!isLeftEdge}
                          onChange={() =>
                            handleSettingChange('workspacePositionMode', 'displayRight')
                          }
                          disabled={isLoading}
                        />
                        {t('settings.workspace.rightEdge')}
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </label>
            <label className="position-option">
              <input
                type="radio"
                name="workspacePositionMode"
                value="fixed"
                checked={editedSettings.workspacePositionMode === 'fixed'}
                onChange={(e) =>
                  handleSettingChange(
                    'workspacePositionMode',
                    e.target.value as WorkspacePositionMode
                  )
                }
                disabled={isLoading}
              />
              <div className="option-content">
                <div className="option-title">{t('settings.workspace.fixed')}</div>
                <div className="option-description">{t('settings.workspace.fixedDescription')}</div>
              </div>
            </label>
          </div>
        </div>

        {/* 透過度設定 */}
        <div className="setting-item">
          <label htmlFor="workspaceOpacity">{t('settings.workspace.opacity')}</label>
          <div className="opacity-control">
            <input
              id="workspaceOpacity"
              type="range"
              min="0"
              max="100"
              value={editedSettings.workspaceOpacity}
              onChange={(e) => handleSettingChange('workspaceOpacity', parseInt(e.target.value))}
              disabled={isLoading}
              className="opacity-slider"
            />
            <span className="opacity-value">{editedSettings.workspaceOpacity}%</span>
          </div>
          <div className="setting-description">{t('settings.workspace.opacityDescription')}</div>
        </div>

        {WORKSPACE_TOGGLES.map(({ key, text }) => (
          <div key={key} className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={editedSettings[key]}
                onChange={(e) => handleSettingChange(key, e.target.checked)}
                disabled={isLoading}
              />
              {t(`settings.workspace.${text}`)}
            </label>
            <div className="setting-description">{t(`settings.workspace.${text}Description`)}</div>
          </div>
        ))}
      </div>
    </>
  );
};

export default AdminSettingsWindowSection;
