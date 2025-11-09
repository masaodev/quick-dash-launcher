import React, { useState } from 'react';

import { HotkeyInput } from './HotkeyInput';
import '../styles/components/FirstLaunchSetup.css';

interface FirstLaunchSetupProps {
  onComplete: (hotkey: string) => void;
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
      onComplete(hotkey);
    } catch (error) {
      console.error('初回設定の保存に失敗しました:', error);
      alert('設定の保存に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="first-launch-setup">
      <div className="first-launch-content">
        <h1 className="first-launch-title">QuickDash Launcherへようこそ</h1>
        <p className="first-launch-description">
          アプリを起動するためのグローバルホットキーを設定してください。
          <br />
          デフォルトは Alt+Space です。他のアプリと競合する場合は変更できます。
        </p>

        <div className="hotkey-setup-section">
          <label htmlFor="hotkey-input" className="hotkey-label">
            グローバルホットキー
          </label>
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
    </div>
  );
};
