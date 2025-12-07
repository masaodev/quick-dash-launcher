import React, { useState } from 'react';

import { HotkeyInput } from './HotkeyInput';
import AlertDialog from './AlertDialog';
import '../styles/components/FirstLaunchSetup.css';

interface FirstLaunchSetupProps {
  onComplete: (hotkey: string, autoLaunch: boolean) => void;
}

/**
 * 初回起動時のホットキー設定画面コンポーネント
 * ユーザーがグローバルホットキーをカスタマイズできるようにする
 */
export const FirstLaunchSetup: React.FC<FirstLaunchSetupProps> = ({ onComplete }) => {
  const [hotkey, setHotkey] = useState<string>('Alt+Space');
  const [hotkeyValidation, setHotkeyValidation] = useState<{ isValid: boolean; reason?: string }>({
    isValid: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState<boolean>(false);

  // AlertDialog状態管理
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    message: string;
    type?: 'info' | 'error' | 'warning' | 'success';
  }>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const handleHotkeyChange = (newHotkey: string) => {
    setHotkey(newHotkey);
  };

  const handleHotkeyValidation = (isValid: boolean, reason?: string) => {
    setHotkeyValidation({ isValid, reason });
  };

  const handleComplete = async () => {
    if (!hotkeyValidation.isValid) {
      return;
    }

    try {
      setIsLoading(true);
      onComplete(hotkey, autoLaunch);
    } catch (error) {
      console.error('初回設定の保存に失敗しました:', error);
      setAlertDialog({
        isOpen: true,
        message: '設定の保存に失敗しました。',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="first-launch-setup">
      <div className="first-launch-content">
        <h1 className="first-launch-title">QuickDash Launcherへようこそ</h1>
        <p className="first-launch-description">初回起動時の設定を行います。</p>

        <div className="hotkey-setup-section">
          <label htmlFor="hotkey-input" className="hotkey-label">
            グローバルホットキー
          </label>
          <p className="section-description">
            アプリを起動するためのキーです（デフォルト: Alt+Space）
          </p>
          <HotkeyInput
            value={hotkey}
            onChange={handleHotkeyChange}
            onValidationChange={handleHotkeyValidation}
            disabled={isLoading}
            placeholder="Alt+Space"
          />
          {!hotkeyValidation.isValid && (
            <div className="validation-error">{hotkeyValidation.reason}</div>
          )}
          <p className="hotkey-hint">
            修飾キー（Ctrl、Alt、Shift等）と通常キーを組み合わせてください。
            <br />
            例: Alt+Space、Ctrl+Alt+W、Ctrl+Shift+L など
          </p>
        </div>

        <div className="auto-launch-setup-section">
          <label className="auto-launch-checkbox-label">
            <input
              type="checkbox"
              checked={autoLaunch}
              onChange={(e) => setAutoLaunch(e.target.checked)}
              disabled={isLoading}
              className="auto-launch-checkbox"
            />
            起動時に自動実行
          </label>
          <p className="auto-launch-hint">Windowsログイン時に自動的に起動します</p>
        </div>

        <div className="first-launch-actions">
          <button
            className="complete-button"
            onClick={handleComplete}
            disabled={isLoading || !hotkeyValidation.isValid}
            type="button"
          >
            設定を完了
          </button>
        </div>
      </div>

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        message={alertDialog.message}
        type={alertDialog.type}
      />
    </div>
  );
};
