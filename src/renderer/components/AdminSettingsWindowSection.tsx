import React, { useEffect, useState } from 'react';
import type {
  AppSettings,
  DisplayInfo,
  WindowPositionMode,
  WorkspacePositionMode,
} from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';

type WindowSizeKey = 'windowWidth' | 'windowHeight' | 'editModeWidth' | 'editModeHeight';

const WINDOW_SIZE_GROUPS: Array<{
  title: string;
  fields: Array<{ label: string; min: number; max: number; key: WindowSizeKey }>;
}> = [
  {
    title: 'メイン画面',
    fields: [
      { label: '幅', min: 400, max: 2000, key: 'windowWidth' },
      { label: '高さ', min: 300, max: 1200, key: 'windowHeight' },
    ],
  },
  {
    title: '管理画面',
    fields: [
      { label: '幅', min: 800, max: 2000, key: 'editModeWidth' },
      { label: '高さ', min: 600, max: 1200, key: 'editModeHeight' },
    ],
  },
];

const WINDOW_POSITION_OPTIONS: Array<{ value: WindowPositionMode; title: string; desc: string }> = [
  {
    value: 'center',
    title: '画面中央（固定）',
    desc: '常にプライマリモニターの中央にウィンドウを表示します',
  },
  {
    value: 'cursorMonitorCenter',
    title: '画面中央（自動切替）',
    desc: 'マウスカーソルがあるモニターの中央にウィンドウを表示します（マルチモニター推奨）',
  },
  {
    value: 'cursor',
    title: 'カーソル付近',
    desc: 'マウスカーソルの近くにウィンドウを表示します（検索入力がしやすい位置）',
  },
  {
    value: 'fixed',
    title: '固定位置（手動設定）',
    desc: 'ウィンドウを移動した位置を記憶して、次回も同じ位置に表示します',
  },
];

/** ワークスペースの表示・連動に関するチェックボックス設定 */
const WORKSPACE_TOGGLES: Array<{
  key:
    | 'workspaceBackgroundTransparent'
    | 'workspaceVisibleOnAllDesktops'
    | 'detachedVisibleOnAllDesktops'
    | 'windowSnapEnabled';
  label: string;
  desc: string;
}> = [
  {
    key: 'workspaceBackgroundTransparent',
    label: '背景のみを透過（アイテムやグループは通常表示）',
    desc: '有効にすると、背景のみが透過され、アイテムやグループは通常通り表示されます。',
  },
  {
    key: 'workspaceVisibleOnAllDesktops',
    label: '全ての仮想デスクトップに表示',
    desc: '有効にすると、ワークスペースウィンドウが全ての仮想デスクトップで表示されます（Windows 10/11の仮想デスクトップ機能）。',
  },
  {
    key: 'detachedVisibleOnAllDesktops',
    label: '切り離しウィンドウも全ての仮想デスクトップに表示',
    desc: '有効にすると、切り離しウィンドウも全ての仮想デスクトップで表示されます。',
  },
  {
    key: 'windowSnapEnabled',
    label: 'ウィンドウ吸着（モニター端へのスナップ）',
    desc: '有効にすると、ワークスペースウィンドウや切り離しウィンドウをモニター端に近づけたとき、自動的に吸着します。',
  },
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
        <h3>ウィンドウサイズ</h3>
        <div className="window-size-grid">
          {WINDOW_SIZE_GROUPS.map(({ title, fields }) => (
            <div key={title} className="window-size-group">
              <div className="window-size-group-title">{title}</div>
              <div className="window-size-inputs">
                {fields.map(({ label, min, max, key }) => (
                  <div key={key} className="window-size-field">
                    <label htmlFor={key}>{label}:</label>
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
        <h3>ウィンドウ表示位置</h3>
        <div className="setting-item">
          <div className="position-options">
            {WINDOW_POSITION_OPTIONS.map(({ value, title, desc }) => (
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
                  <div className="option-title">{title}</div>
                  <div className="option-description">{desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>ワークスペースウィンドウ</h3>

        {/* 自動表示設定 */}
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.autoShowWorkspace}
              onChange={(e) => handleSettingChange('autoShowWorkspace', e.target.checked)}
              disabled={isLoading}
            />
            メイン画面表示時にワークスペースを自動表示
          </label>
          <div className="setting-description">
            有効にすると、メイン画面を開いたときにワークスペースが非表示なら自動で表示します。
          </div>
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
            メインウィンドウ非表示時に切り離しウィンドウも連動して非表示にする
          </label>
          <div className="setting-description">
            有効にすると、メイン画面の表示/非表示に連動して切り離しウィンドウも表示/非表示します。
            切り離しウィンドウを操作中はメイン画面が非表示でも切り離しウィンドウは表示されたままになります。
          </div>
        </div>

        {/* 表示位置設定 */}
        <div className="setting-item">
          <label>表示位置:</label>
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
                <div className="option-title">ディスプレイの端に配置（デフォルト）</div>
                <div className="option-description">
                  選択したディスプレイの左端または右端にワークスペースを配置します
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
                        左端
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
                        右端
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
                <div className="option-title">固定位置（手動設定）</div>
                <div className="option-description">
                  ワークスペースを移動した位置を記憶して、次回も同じ位置に表示します
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* 透過度設定 */}
        <div className="setting-item">
          <label htmlFor="workspaceOpacity">透過度:</label>
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
          <div className="setting-description">
            ワークスペースウィンドウの透過度を調整します（0%=完全透明、100%=完全不透明）。
          </div>
        </div>

        {WORKSPACE_TOGGLES.map(({ key, label, desc }) => (
          <div key={key} className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={editedSettings[key]}
                onChange={(e) => handleSettingChange(key, e.target.checked)}
                disabled={isLoading}
              />
              {label}
            </label>
            <div className="setting-description">{desc}</div>
          </div>
        ))}
      </div>
    </>
  );
};

export default AdminSettingsWindowSection;
