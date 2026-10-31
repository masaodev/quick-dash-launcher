/**
 * 画面: 初回設定画面
 * 画面仕様: docs/screens/first-launch-setup.md
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import '../styles/components/SetupFirstLaunch.css';

import { HotkeyInput } from './HotkeyInput';
import { Button } from './ui';

interface HotkeyValidation {
  isValid: boolean;
  reason?: string;
}

interface FirstLaunchSettings {
  hotkey: string;
  autoLaunch: boolean;
  itemSearchHotkey: string;
  /** 新しい版が出たら知らせる（Store 版では出さないので undefined） */
  updateCheckEnabled?: boolean;
}

interface FirstLaunchSetupProps {
  /** 保存できたら true。false なら画面に知らせて、もう一度押せるように戻す */
  onComplete: (settings: FirstLaunchSettings) => Promise<boolean>;
}

type SetupStep = 'welcome' | 'hotkey' | 'try';

const STEPS: SetupStep[] = ['welcome', 'hotkey', 'try'];

const STEP_LABEL_KEYS = {
  welcome: 'firstLaunch.stepWelcome',
  hotkey: 'firstLaunch.stepHotkey',
  try: 'firstLaunch.stepTry',
} as const;

const FEATURES = [
  { icon: '⌨️', title: 'firstLaunch.featureHotkeyTitle', body: 'firstLaunch.featureHotkeyBody' },
  { icon: '🔎', title: 'firstLaunch.featureSearchTitle', body: 'firstLaunch.featureSearchBody' },
  { icon: '🗂️', title: 'firstLaunch.featureTabsTitle', body: 'firstLaunch.featureTabsBody' },
] as const;

/** 「Alt+Space」をキーの形で並べる */
const HotkeyKeys: React.FC<{ hotkey: string }> = ({ hotkey }) => (
  <div className="first-launch-keys" aria-hidden="true">
    {hotkey.split('+').map((key, index) => (
      <React.Fragment key={`${key}-${index}`}>
        {index > 0 && <span className="first-launch-key-plus">+</span>}
        <kbd className="first-launch-key">{key}</kbd>
      </React.Fragment>
    ))}
  </div>
);

/**
 * 初回起動時の設定画面コンポーネント
 * 「ようこそ → ホットキー → 試してみる」の 3 ステップで、起動ホットキーと自動起動を決める
 */
export const SetupFirstLaunch: React.FC<FirstLaunchSetupProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<SetupStep>('welcome');
  const [hotkey, setHotkey] = useState('Alt+Space');
  const [hotkeyValidation, setHotkeyValidation] = useState<HotkeyValidation>({ isValid: true });
  const [itemSearchHotkey, setItemSearchHotkey] = useState('Ctrl+Alt+Space');
  const [itemSearchHotkeyValidation, setItemSearchHotkeyValidation] = useState<HotkeyValidation>({
    isValid: true,
  });
  const [hotkeyInUse, setHotkeyInUse] = useState(false);
  const [itemSearchHotkeyInUse, setItemSearchHotkeyInUse] = useState(false);
  const [showMoreHotkeys, setShowMoreHotkeys] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [hotkeyPressed, setHotkeyPressed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState(true);
  const [updateCheckEnabled, setUpdateCheckEnabled] = useState(true);
  // Store 版は Store が更新するので「新しい版が出たら知らせる」を出さない
  const [isStore, setIsStore] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const isValid = hotkeyValidation.isValid && itemSearchHotkeyValidation.isValid;

  useEffect(() => {
    let cancelled = false;
    void window.electronAPI.getAppInfo().then((info) => {
      if (!cancelled) setIsStore(info.distribution === 'store');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 「試してみる」の間だけ、起動ホットキーが押されたことを受け取る
  useEffect(() => {
    if (step !== 'try') return;
    setHotkeyPressed(false);
    return window.electronAPI.onFirstLaunchHotkeyPressed(() => setHotkeyPressed(true));
  }, [step]);

  const handleHotkeyChange = (newHotkey: string) => {
    setHotkey(newHotkey);
    setHotkeyInUse(false);
  };

  const handleItemSearchHotkeyChange = (newHotkey: string) => {
    setItemSearchHotkey(newHotkey);
    setItemSearchHotkeyInUse(false);
  };

  // 先にキーを登録してみて、ほかのアプリが使っていたら先へ進まない
  const handleHotkeyNext = async () => {
    if (!isValid) return;
    setIsRegistering(true);
    try {
      const registered = await window.electronAPI.changeHotkey(hotkey);
      if (!registered) {
        setHotkeyInUse(true);
        return;
      }
      // ウィンドウ検索のキーも、ほかのアプリが使っていたら閉じた欄を開いて知らせる（登録は「使いはじめる」まで待つ）
      if (
        itemSearchHotkey &&
        !(await window.electronAPI.isItemSearchHotkeyAvailable(itemSearchHotkey))
      ) {
        setItemSearchHotkeyInUse(true);
        setShowMoreHotkeys(true);
        return;
      }
      setStep('try');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleComplete = async () => {
    if (!isValid) return;
    setIsLoading(true);
    setSaveFailed(false);
    const saved = await onComplete({
      hotkey,
      autoLaunch,
      itemSearchHotkey,
      ...(isStore ? {} : { updateCheckEnabled }),
    });
    // 保存できたら画面ごと切り替わるので、戻すのは失敗したときだけ
    if (!saved) {
      setIsLoading(false);
      setSaveFailed(true);
    }
  };

  const currentIndex = STEPS.indexOf(step);

  return (
    <div className="first-launch-setup">
      <div className="first-launch-content">
        <ol className="first-launch-steps">
          {STEPS.map((s, index) => {
            const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : '';
            return (
              <li key={s} className={`first-launch-step ${state}`}>
                {index < currentIndex ? '✓' : index + 1} {t(STEP_LABEL_KEYS[s])}
              </li>
            );
          })}
        </ol>

        {step === 'welcome' && (
          <>
            <h1 className="first-launch-title">{t('firstLaunch.title')}</h1>
            <p className="first-launch-description first-launch-lead">
              {t('firstLaunch.description')}
            </p>
            <ul className="first-launch-features">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="first-launch-feature">
                  <span className="first-launch-feature-icon" aria-hidden="true">
                    {feature.icon}
                  </span>
                  <div>
                    <div className="first-launch-feature-title">{t(feature.title)}</div>
                    <div className="first-launch-feature-body">{t(feature.body)}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="first-launch-actions">
              <Button variant="primary" type="button" onClick={() => setStep('hotkey')}>
                {t('firstLaunch.next')}
              </Button>
            </div>
          </>
        )}

        {step === 'hotkey' && (
          <>
            <h1 className="first-launch-title">{t('firstLaunch.hotkeyTitle')}</h1>
            <p className="first-launch-description">{t('firstLaunch.hotkeyDescription')}</p>
            <HotkeyKeys hotkey={hotkey} />
            {hotkeyInUse ? (
              <p className="validation-error first-launch-center">{t('firstLaunch.hotkeyInUse')}</p>
            ) : (
              <p className="hotkey-hint first-launch-center">
                {t('firstLaunch.hotkeyKeepDefault')}
              </p>
            )}

            <div className="hotkey-setup-section launch-hotkey-section">
              <label className="hotkey-label">{t('firstLaunch.hotkeyChangeLabel')}</label>
              <HotkeyInput
                value={hotkey}
                onChange={handleHotkeyChange}
                onValidationChange={(valid, reason) =>
                  setHotkeyValidation({ isValid: valid, reason })
                }
                disabled={isRegistering}
                placeholder="Alt+Space"
              />
              {!hotkeyValidation.isValid && (
                <div className="validation-error">{hotkeyValidation.reason}</div>
              )}
              <p className="hotkey-hint">{t('firstLaunch.hotkeyHint')}</p>
            </div>

            <details
              className="first-launch-more"
              open={showMoreHotkeys}
              onToggle={(e) => setShowMoreHotkeys(e.currentTarget.open)}
            >
              <summary>{t('firstLaunch.windowSearchHotkeySummary')}</summary>
              <div className="hotkey-setup-section item-search-hotkey-section">
                <p className="section-description">
                  {t('firstLaunch.windowSearchHotkeyDescription')}
                </p>
                <HotkeyInput
                  value={itemSearchHotkey}
                  onChange={handleItemSearchHotkeyChange}
                  onValidationChange={(valid, reason) =>
                    setItemSearchHotkeyValidation({ isValid: valid, reason })
                  }
                  disabled={isRegistering}
                  placeholder={t('firstLaunch.notSet')}
                  allowEmpty={true}
                  showClearButton={true}
                  clearLabel={t('firstLaunch.windowSearchHotkeyNone')}
                />
                {!itemSearchHotkeyValidation.isValid && (
                  <div className="validation-error">{itemSearchHotkeyValidation.reason}</div>
                )}
                {itemSearchHotkeyInUse && (
                  <div className="validation-error">{t('firstLaunch.windowSearchHotkeyInUse')}</div>
                )}
              </div>
            </details>

            <div className="first-launch-actions first-launch-actions-split">
              <Button variant="secondary" type="button" onClick={() => setStep('welcome')}>
                {t('firstLaunch.back')}
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={handleHotkeyNext}
                disabled={!isValid || isRegistering}
              >
                {t('firstLaunch.next')}
              </Button>
            </div>
          </>
        )}

        {step === 'try' && (
          <>
            <h1 className="first-launch-title">{t('firstLaunch.tryTitle')}</h1>
            <p className="first-launch-description">{t('firstLaunch.tryDescription')}</p>
            <div className={`first-launch-try ${hotkeyPressed ? 'pressed' : ''}`}>
              <HotkeyKeys hotkey={hotkey} />
              {hotkeyPressed ? (
                <div className="first-launch-try-ok">{t('firstLaunch.tryOk')}</div>
              ) : (
                <>
                  <div className="first-launch-try-waiting">{t('firstLaunch.tryWaiting')}</div>
                  <div className="hotkey-hint">{t('firstLaunch.tryNotWorking')}</div>
                </>
              )}
            </div>

            <div className="first-launch-getting-started">
              <div className="first-launch-getting-started-label">
                {t('firstLaunch.gettingStartedLabel')}
              </div>
              <p>{t('firstLaunch.gettingStartedSamples')}</p>
              <p>{t('firstLaunch.gettingStartedAdd')}</p>
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
              {!isStore && (
                <>
                  <label className="auto-launch-checkbox-label">
                    <input
                      type="checkbox"
                      checked={updateCheckEnabled}
                      onChange={(e) => setUpdateCheckEnabled(e.target.checked)}
                      disabled={isLoading}
                      className="auto-launch-checkbox"
                      data-testid="first-launch-update-check"
                    />
                    {t('firstLaunch.updateCheck')}
                  </label>
                  <p className="auto-launch-hint">{t('firstLaunch.updateCheckHint')}</p>
                </>
              )}
            </div>

            {saveFailed && (
              <p className="validation-error first-launch-center" role="alert">
                {t('firstLaunch.saveFailed')}
              </p>
            )}

            <div className="first-launch-actions first-launch-actions-split">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setStep('hotkey')}
                disabled={isLoading}
              >
                {t('firstLaunch.back')}
              </Button>
              <span className="first-launch-change-later">{t('firstLaunch.changeLater')}</span>
              <Button
                variant="primary"
                type="button"
                onClick={handleComplete}
                // キーで呼び出せたことを確かめてから使いはじめる（出ないときは「戻る」で選び直す）
                disabled={isLoading || !isValid || !hotkeyPressed}
              >
                {t('firstLaunch.complete')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
