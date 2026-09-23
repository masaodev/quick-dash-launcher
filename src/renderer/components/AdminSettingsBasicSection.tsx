import React, { useState } from 'react';
import type { AppSettings } from '@common/types';

import type { HandleSettingChange } from '../hooks/useSettingsManager';

import { HotkeyInput } from './HotkeyInput';

interface AdminSettingsBasicSectionProps {
  editedSettings: AppSettings;
  isLoading: boolean;
  handleSettingChange: HandleSettingChange;
  hotkeyValidation: { isValid: boolean; reason?: string };
  onHotkeyValidation: (isValid: boolean, reason?: string) => void;
  onItemSearchHotkeyChange: (hotkey: string) => void;
}

/** 設定画面「基本設定」: 起動ホットキー・システム・グループ起動 */
const AdminSettingsBasicSection: React.FC<AdminSettingsBasicSectionProps> = ({
  editedSettings,
  isLoading,
  handleSettingChange,
  hotkeyValidation,
  onHotkeyValidation,
  onItemSearchHotkeyChange,
}) => {
  // アイテム検索ホットキーのバリデーション状態
  const [itemSearchHotkeyValidation, setItemSearchHotkeyValidation] = useState<{
    isValid: boolean;
    reason?: string;
  }>({ isValid: true });

  return (
    <>
      <div className="settings-section">
        <h3>起動ホットキー</h3>
        <div className="setting-item">
          <label htmlFor="hotkey">ランチャー起動:</label>
          <HotkeyInput
            value={editedSettings.hotkey}
            onChange={(hotkey) => handleSettingChange('hotkey', hotkey)}
            onValidationChange={onHotkeyValidation}
            disabled={isLoading}
            placeholder="Alt+Space"
          />
          {!hotkeyValidation.isValid && (
            <div className="validation-error">{hotkeyValidation.reason}</div>
          )}
        </div>
        <div className="setting-item">
          <label htmlFor="itemSearchHotkey">ウィンドウ検索で起動:</label>
          <HotkeyInput
            value={editedSettings.itemSearchHotkey || ''}
            onChange={onItemSearchHotkeyChange}
            onValidationChange={(isValid, reason) =>
              setItemSearchHotkeyValidation({ isValid, reason })
            }
            disabled={isLoading}
            placeholder="設定なし（オプション）"
            allowEmpty={true}
            showClearButton={true}
          />
          {!itemSearchHotkeyValidation.isValid && (
            <div className="validation-error">{itemSearchHotkeyValidation.reason}</div>
          )}
          <div className="setting-description">
            このホットキーでウィンドウ検索モードとして起動します。設定なしで無効化されます。
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
        <h3>グループ起動</h3>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.parallelGroupLaunch}
              onChange={(e) => handleSettingChange('parallelGroupLaunch', e.target.checked)}
              disabled={isLoading}
            />
            グループアイテムを並列起動
          </label>
          <div className="setting-description">
            有効にすると、グループ内のアイテムを順次実行せずに並列で起動します。起動速度が向上しますが、順序が保証されません。
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminSettingsBasicSection;
