import React, { useState } from 'react';

import '../styles/components/SetupFirstLaunch.css';

import { HotkeyInput } from './HotkeyInput';
import { Button } from './ui/Button';

interface HotkeyValidation {
  isValid: boolean;
  reason?: string;
}

interface FirstLaunchSettings {
  hotkey: string;
  autoLaunch: boolean;
  itemSearchHotkey: string;
}

interface FirstLaunchSetupProps {
  onComplete: (settings: FirstLaunchSettings) => void;
}

/**
 * 初回起動時のホットキー設定画面コンポーネント
 * ユーザーがランチャー起動ホットキーをカスタマイズできるようにする
 */
export const SetupFirstLaunch: React.FC<FirstLaunchSetupProps> = ({ onComplete }) => {
  const [hotkey, setHotkey] = useState('Alt+Space');
  const [hotkeyValidation, setHotkeyValidation] = useState<HotkeyValidation>({ isValid: true });
  const [itemSearchHotkey, setItemSearchHotkey] = useState('');
  const [itemSearchHotkeyValidation, setItemSearchHotkeyValidation] = useState<HotkeyValidation>({
    isValid: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState(false);

  const isValid = hotkeyValidation.isValid && itemSearchHotkeyValidation.isValid;

  const handleComplete = () => {
    if (!isValid) return;
    setIsLoading(true);
    onComplete({ hotkey, autoLaunch, itemSearchHotkey });
  };

  return (
    <div className="first-launch-setup">
      <div className="first-launch-content">
        <h1 className="first-launch-title">QuickDash Launcherへようこそ</h1>
        <p className="first-launch-description">初回起動時の設定を行います。</p>

        <div className="hotkey-setup-section">
          <label htmlFor="hotkey-input" className="hotkey-label">
            ランチャー起動ホットキー
          </label>
          <p className="section-description">
            ランチャーを起動するためのキーです（デフォルト: Alt+Space）
          </p>
          <HotkeyInput
            value={hotkey}
            onChange={setHotkey}
            onValidationChange={(valid, reason) => setHotkeyValidation({ isValid: valid, reason })}
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

        <div className="hotkey-setup-section">
          <label htmlFor="item-search-hotkey-input" className="hotkey-label">
            ウィンドウ検索で起動のホットキー
          </label>
          <p className="section-description">
            ウィンドウ検索モードで直接起動するためのキーです（デフォルト: 未設定）
          </p>
          <HotkeyInput
            value={itemSearchHotkey}
            onChange={setItemSearchHotkey}
            onValidationChange={(valid, reason) =>
              setItemSearchHotkeyValidation({ isValid: valid, reason })
            }
            disabled={isLoading}
            placeholder="未設定"
            allowEmpty={true}
            showClearButton={true}
          />
          {!itemSearchHotkeyValidation.isValid && (
            <div className="validation-error">{itemSearchHotkeyValidation.reason}</div>
          )}
          <p className="hotkey-hint">
            設定するとこのキーでウィンドウ検索モードが直接開きます。後から設定することもできます。
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
          <Button
            variant="primary"
            onClick={handleComplete}
            disabled={isLoading || !isValid}
            type="button"
          >
            設定を完了
          </Button>
        </div>
      </div>
    </div>
  );
};
