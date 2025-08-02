import React, { useState, useEffect } from 'react';

import { AppSettings } from '../../common/types';

import { HotkeyInput } from './HotkeyInput';
import '../styles/components/SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [editedSettings, setEditedSettings] = useState<AppSettings | null>(null);
  const [hotkeyValidation, setHotkeyValidation] = useState<{ isValid: boolean; reason?: string }>({
    isValid: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 設定を読み込み
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const currentSettings = await window.electronAPI.getSettings();
      setSettings(currentSettings);
      setEditedSettings({ ...currentSettings });
    } catch (error) {
      console.error('設定の読み込みに失敗しました:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // モーダルが開かれたときに設定を読み込み
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // 変更検知
  useEffect(() => {
    if (settings && editedSettings) {
      const changed = JSON.stringify(settings) !== JSON.stringify(editedSettings);
      setHasChanges(changed);
    }
  }, [settings, editedSettings]);

  // 設定項目の変更ハンドラ
  const handleSettingChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (editedSettings) {
      setEditedSettings({
        ...editedSettings,
        [key]: value,
      });
    }
  };

  // ホットキーバリデーション結果の処理
  const handleHotkeyValidation = (isValid: boolean, reason?: string) => {
    setHotkeyValidation({ isValid, reason });
  };

  // 設定保存
  const handleSave = async () => {
    if (!editedSettings || !hotkeyValidation.isValid) {
      return;
    }

    try {
      setIsLoading(true);
      await window.electronAPI.setMultipleSettings(editedSettings);
      setSettings({ ...editedSettings });
      setHasChanges(false);
      onClose();
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
      await loadSettings();
    } catch (error) {
      console.error('設定のリセットに失敗しました:', error);
      alert('設定のリセットに失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  // キャンセル
  const handleCancel = () => {
    if (hasChanges && !confirm('変更が保存されていません。破棄しますか？')) {
      return;
    }
    onClose();
  };

  if (!isOpen || !editedSettings) {
    return null;
  }

  return (
    <div className="settings-modal-overlay" onClick={handleCancel}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h2>設定</h2>
          <button className="close-button" onClick={handleCancel}>
            ×
          </button>
        </div>

        <div className="settings-modal-content">
          {isLoading && <div className="loading-overlay">読み込み中...</div>}

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
        </div>

        <div className="settings-modal-footer">
          <button className="reset-button" onClick={handleReset} disabled={isLoading}>
            リセット
          </button>
          <div className="button-group">
            <button className="cancel-button" onClick={handleCancel} disabled={isLoading}>
              キャンセル
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
    </div>
  );
};
