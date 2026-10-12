import React, { useEffect, useState } from 'react';
import type { AppSettings, AutoLaunchStatus } from '@common/types';

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

/** 設定画面「基本設定」: 起動ホットキー・システム・表示・グループ起動 */
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

  // OS 側の自動起動の状態（Store 版で、設定と Windows 側の状態が食い違うときに案内する）
  // 保存が終わった後（設定の変更通知）と、Windows の設定から戻ってきたとき（フォーカス）に読み直す
  const [autoLaunchStatus, setAutoLaunchStatus] = useState<AutoLaunchStatus | null>(null);
  useEffect(() => {
    const loadStatus = () => {
      window.electronAPI
        .getAutoLaunchStatus()
        .then(setAutoLaunchStatus)
        .catch(() => setAutoLaunchStatus(null));
    };
    loadStatus();
    window.addEventListener('focus', loadStatus);
    const unsubscribe = window.electronAPI.onSettingsChanged(loadStatus);
    return () => {
      window.removeEventListener('focus', loadStatus);
      unsubscribe();
    };
  }, []);
  const storeState = autoLaunchStatus?.mode === 'store' ? autoLaunchStatus.state : null;
  const blockedByWindows =
    editedSettings.autoLaunch &&
    (storeState === 'disabledByUser' || storeState === 'disabledByPolicy');
  const enabledByWindows =
    !editedSettings.autoLaunch && (storeState === 'enabled' || storeState === 'enabledByPolicy');

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
          {blockedByWindows && (
            <div className="validation-error">
              {storeState === 'disabledByPolicy'
                ? '組織のポリシーで自動起動が無効になっているため、ここからは有効にできません。'
                : 'Windows の設定で自動起動が無効になっているため、ここからは有効にできません。Windows の［設定］→［アプリ］→［スタートアップ］で QuickDashLauncher をオンにしてください。'}
            </div>
          )}
          {enabledByWindows && (
            <div className="setting-description">
              {storeState === 'enabledByPolicy'
                ? '組織のポリシーで自動起動が有効になっています。'
                : 'Windows の設定で自動起動が有効になっています。止めるときは、チェックを付けてから外すか、Windows の［設定］→［アプリ］→［スタートアップ］でオフにしてください。'}
            </div>
          )}
        </div>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.cliEnabled}
              onChange={(e) => handleSettingChange('cliEnabled', e.target.checked)}
              disabled={isLoading}
            />
            コマンドライン（qdl）を使えるようにする
          </label>
          <div className="setting-description">
            qdl コマンドを PATH に追加し、ターミナルや AI から QuickDashLauncher
            に依頼できるようにします（新しく開いたターミナルから使えます）。
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>表示</h3>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.showKeyboardHints}
              onChange={(e) => handleSettingChange('showKeyboardHints', e.target.checked)}
              disabled={isLoading}
            />
            操作のヒントを表示
          </label>
          <div className="setting-description">
            メインウィンドウの下に、気づきにくいキー操作（F2 で編集、Shift+Enter
            で親フォルダーを開くなど）を表示します。
          </div>
        </div>
        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              checked={editedSettings.showDataFileTabs}
              onChange={(e) => handleSettingChange('showDataFileTabs', e.target.checked)}
              disabled={isLoading}
            />
            複数タブを表示
          </label>
          <div className="setting-description">
            メインウィンドウでタブを切り替えて、別のデータファイルのアイテムを表示します。タブとデータファイルの追加・変更は「アイテム管理」で行います。
          </div>
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
