/**
 * 画面: 初回設定画面
 * 画面仕様: docs/screens/first-launch-setup.md
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [hotkey, setHotkey] = useState('Alt+Space');
  const [hotkeyValidation, setHotkeyValidation] = useState<HotkeyValidation>({ isValid: true });
  const [itemSearchHotkey, setItemSearchHotkey] = useState('Ctrl+Alt+Space');
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
        <h1 className="first-launch-title">{t('firstLaunch.title')}</h1>
        <p className="first-launch-description">{t('firstLaunch.description')}</p>

        <div className="hotkey-setup-section">
          <label htmlFor="hotkey-input" className="hotkey-label">
            {t('firstLaunch.hotkeyLabel')}
          </label>
          <p className="section-description">{t('firstLaunch.hotkeyDescription')}</p>
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
            {t('firstLaunch.hotkeyHint')}
            <br />
            {t('firstLaunch.hotkeyExample')}
          </p>
        </div>

        <div className="hotkey-setup-section">
          <label htmlFor="item-search-hotkey-input" className="hotkey-label">
            {t('firstLaunch.windowSearchHotkeyLabel')}
          </label>
          <p className="section-description">{t('firstLaunch.windowSearchHotkeyDescription')}</p>
          <HotkeyInput
            value={itemSearchHotkey}
            onChange={setItemSearchHotkey}
            onValidationChange={(valid, reason) =>
              setItemSearchHotkeyValidation({ isValid: valid, reason })
            }
            disabled={isLoading}
            placeholder={t('firstLaunch.notSet')}
            allowEmpty={true}
            showClearButton={true}
          />
          {!itemSearchHotkeyValidation.isValid && (
            <div className="validation-error">{itemSearchHotkeyValidation.reason}</div>
          )}
          <p className="hotkey-hint">{t('firstLaunch.windowSearchHotkeyHint')}</p>
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
            {t('firstLaunch.autoLaunch')}
          </label>
          <p className="auto-launch-hint">{t('firstLaunch.autoLaunchHint')}</p>
        </div>

        <div className="first-launch-actions">
          <Button
            variant="primary"
            onClick={handleComplete}
            disabled={isLoading || !isValid}
            type="button"
          >
            {t('firstLaunch.complete')}
          </Button>
        </div>
      </div>
    </div>
  );
};
