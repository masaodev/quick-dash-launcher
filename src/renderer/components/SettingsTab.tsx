import React, { useState, useEffect } from 'react';

import { AppSettings } from '../../common/types';

import { HotkeyInput } from './HotkeyInput';

interface SettingsTabProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => Promise<void>;
  onUnsavedChanges: (hasChanges: boolean) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onSave, onUnsavedChanges }) => {
  const [editedSettings, setEditedSettings] = useState<AppSettings>(settings);
  const [hotkeyValidation, setHotkeyValidation] = useState<{ isValid: boolean; reason?: string }>({
    isValid: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // settingsプロパティが変更されたときにeditedSettingsを更新
  useEffect(() => {
    setEditedSettings(settings);
  }, [settings]);

  // 変更検知
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(editedSettings);
    setHasChanges(changed);
    onUnsavedChanges(changed);
  }, [settings, editedSettings, onUnsavedChanges]);

  // 設定項目の変更ハンドラ
  const handleSettingChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setEditedSettings({
      ...editedSettings,
      [key]: value,
    });
  };

  // ホットキーバリデーション結果の処理
  const handleHotkeyValidation = (isValid: boolean, reason?: string) => {
    setHotkeyValidation({ isValid, reason });
  };

  // 設定保存
  const handleSave = async () => {
    if (!hotkeyValidation.isValid) {
      return;
    }

    try {
      setIsLoading(true);
      await onSave(editedSettings);
      setHasChanges(false);
      onUnsavedChanges(false);
    } catch (error) {
      console.error('設定の保存に失敗しました:', error);
      alert('設定の保存に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 設定リセット
  const handleReset = async () => {
    if (!confirm('設定をデフォルト値にリセットしますか？')) {
      return;
    }

    try {
      setIsLoading(true);
      await window.electronAPI.resetSettings();
      const resetSettings = await window.electronAPI.getSettings();
      setEditedSettings(resetSettings);
    } catch (error) {
      console.error('設定のリセットに失敗しました:', error);
      alert('設定のリセットに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // 変更を元に戻す
  const handleRevert = () => {
    if (hasChanges && confirm('変更を元に戻しますか？')) {
      setEditedSettings(settings);
    }
  };

  return (
    <div className="settings-tab">
      {isLoading && <div className="loading-overlay">処理中...</div>}

      <div className="settings-content">
        <div className="settings-section">
          <h3>ホットキー</h3>
          <div className="setting-item">
            <label htmlFor="hotkey">グローバルホットキー:</label>
            <HotkeyInput
              value={editedSettings.hotkey}
              onChange={(hotkey) => handleSettingChange('hotkey', hotkey)}
              onValidationChange={handleHotkeyValidation}
              disabled={isLoading}
              placeholder="Ctrl+Alt+W"
            />
            {!hotkeyValidation.isValid && (
              <div className="validation-error">{hotkeyValidation.reason}</div>
            )}
          </div>
        </div>

        <div className="settings-section">
          <h3>ウィンドウサイズ</h3>
          <div className="setting-row">
            <div className="setting-item">
              <label htmlFor="windowWidth">通常時の幅:</label>
              <input
                id="windowWidth"
                type="number"
                min="400"
                max="2000"
                value={editedSettings.windowWidth}
                onChange={(e) => handleSettingChange('windowWidth', parseInt(e.target.value))}
                disabled={isLoading}
              />
              <span className="unit">px</span>
            </div>
            <div className="setting-item">
              <label htmlFor="windowHeight">通常時の高さ:</label>
              <input
                id="windowHeight"
                type="number"
                min="300"
                max="1200"
                value={editedSettings.windowHeight}
                onChange={(e) => handleSettingChange('windowHeight', parseInt(e.target.value))}
                disabled={isLoading}
              />
              <span className="unit">px</span>
            </div>
          </div>
          <div className="setting-row">
            <div className="setting-item">
              <label htmlFor="editModeWidth">アイテム管理時の幅:</label>
              <input
                id="editModeWidth"
                type="number"
                min="800"
                max="2000"
                value={editedSettings.editModeWidth}
                onChange={(e) => handleSettingChange('editModeWidth', parseInt(e.target.value))}
                disabled={isLoading}
              />
              <span className="unit">px</span>
            </div>
            <div className="setting-item">
              <label htmlFor="editModeHeight">アイテム管理時の高さ:</label>
              <input
                id="editModeHeight"
                type="number"
                min="600"
                max="1200"
                value={editedSettings.editModeHeight}
                onChange={(e) => handleSettingChange('editModeHeight', parseInt(e.target.value))}
                disabled={isLoading}
              />
              <span className="unit">px</span>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>システム</h3>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={editedSettings.autoLaunch}
                onChange={(e) => handleSettingChange('autoLaunch', e.target.checked)}
                disabled={isLoading}
              />
              起動時に自動実行
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3>バックアップ</h3>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={editedSettings.backupEnabled}
                onChange={(e) => handleSettingChange('backupEnabled', e.target.checked)}
                disabled={isLoading}
              />
              バックアップ機能を有効にする
            </label>
          </div>

          {editedSettings.backupEnabled && (
            <>
              <div className="setting-item indent">
                <label>
                  <input
                    type="checkbox"
                    checked={editedSettings.backupOnStart}
                    onChange={(e) => handleSettingChange('backupOnStart', e.target.checked)}
                    disabled={isLoading}
                  />
                  アプリ起動時にバックアップを作成
                </label>
              </div>

              <div className="setting-item indent">
                <label>
                  <input
                    type="checkbox"
                    checked={editedSettings.backupOnEdit}
                    onChange={(e) => handleSettingChange('backupOnEdit', e.target.checked)}
                    disabled={isLoading}
                  />
                  データ編集時にバックアップを作成
                </label>
              </div>

              <div className="setting-item indent">
                <label htmlFor="backupInterval">最小バックアップ間隔:</label>
                <input
                  id="backupInterval"
                  type="number"
                  min="1"
                  max="60"
                  value={editedSettings.backupInterval}
                  onChange={(e) => handleSettingChange('backupInterval', parseInt(e.target.value))}
                  disabled={isLoading}
                />
                <span className="unit">分</span>
              </div>

              <div className="setting-item indent">
                <label htmlFor="backupRetention">バックアップ保存件数:</label>
                <input
                  id="backupRetention"
                  type="number"
                  min="1"
                  max="100"
                  value={editedSettings.backupRetention}
                  onChange={(e) => handleSettingChange('backupRetention', parseInt(e.target.value))}
                  disabled={isLoading}
                />
                <span className="unit">件</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="settings-footer">
        <button className="reset-button" onClick={handleReset} disabled={isLoading}>
          リセット
        </button>
        <div className="button-group">
          <button
            className="revert-button"
            onClick={handleRevert}
            disabled={isLoading || !hasChanges}
          >
            元に戻す
          </button>
          <button
            className="save-button"
            onClick={handleSave}
            disabled={isLoading || !hasChanges || !hotkeyValidation.isValid}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
