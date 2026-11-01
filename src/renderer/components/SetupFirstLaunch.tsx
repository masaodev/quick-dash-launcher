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
  /** データを exe の横に保存する（ZIP 版で選べるときだけ。選ばなければ undefined） */
  portableMode?: boolean;
}

interface FirstLaunchSetupProps {
  /** 保存できたら true。false なら画面に知らせて、もう一度押せるように戻す */
  onComplete: (settings: FirstLaunchSettings) => Promise<boolean>;
}

type SetupStep = 'welcome' | 'hotkey' | 'try' | 'finish';

const STEPS: SetupStep[] = ['welcome', 'hotkey', 'try', 'finish'];

/** 試してみるで ✓ を出してから、仕上げへ自動で進むまでの時間 */
export const FINISH_DELAY_MS = 1200;

const STEP_LABEL_KEYS = {
  welcome: 'firstLaunch.stepWelcome',
  hotkey: 'firstLaunch.stepHotkey',
  try: 'firstLaunch.stepTry',
  finish: 'firstLaunch.stepFinish',
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

/** 見出しの文中に入れる形（「Alt+Space」→「Alt + Space」） */
const formatHotkey = (hotkey: string) => hotkey.split('+').join(' + ');

/**
 * 初回起動時の設定画面コンポーネント
 * 「ようこそ → ホットキー → 試してみる → 仕上げ」の 4 ステップで、起動ホットキーと自動起動を決める
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
  // ZIP 版で、まだデータフォルダが無いときだけ「データを exe の横に保存する」を出す（既定はオフ）
  const [portableModeAvailable, setPortableModeAvailable] = useState(false);
  const [portableMode, setPortableMode] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const isValid = hotkeyValidation.isValid && itemSearchHotkeyValidation.isValid;

  useEffect(() => {
    let cancelled = false;
    void window.electronAPI.getAppInfo().then((info) => {
      if (cancelled) return;
      setIsStore(info.distribution === 'store');
      setPortableModeAvailable(info.portableModeAvailable === true);
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

  // 呼び出せたら、✓ を少し見せてから仕上げへ進む
  useEffect(() => {
    if (step !== 'try' || !hotkeyPressed) return;
    const timer = setTimeout(() => setStep('finish'), FINISH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [step, hotkeyPressed]);

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
      ...(portableModeAvailable && portableMode ? { portableMode: true } : {}),
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
            <h1 className="first-launch-title">
              {t('firstLaunch.tryTitle', { hotkey: formatHotkey(hotkey) })}
            </h1>
            <div className={`first-launch-try ${hotkeyPressed ? 'pressed' : ''}`}>
              <HotkeyKeys hotkey={hotkey} />
              {hotkeyPressed ? (
                <div className="first-launch-try-ok" role="status">
                  {t('firstLaunch.tryOk')}
                </div>
              ) : (
                <div className="first-launch-try-waiting">
                  <span className="first-launch-try-dot" aria-hidden="true" />
                  {t('firstLaunch.tryWaiting')}
                </div>
              )}
            </div>
            <p className="hotkey-hint first-launch-center">{t('firstLaunch.tryNotWorking')}</p>

            <div className="first-launch-actions first-launch-actions-split">
              <Button variant="secondary" type="button" onClick={() => setStep('hotkey')}>
                {t('firstLaunch.back')}
              </Button>
              {hotkeyPressed ? (
                <Button variant="primary" type="button" onClick={() => setStep('finish')}>
                  {t('firstLaunch.next')}
                </Button>
              ) : (
                <Button variant="secondary" type="button" onClick={() => setStep('finish')}>
                  {t('firstLaunch.trySkip')}
                </Button>
              )}
            </div>
          </>
        )}

        {step === 'finish' && (
          <>
            <h1 className="first-launch-title">{t('firstLaunch.finishTitle')}</h1>
            {!hotkeyPressed && (
              <p className="first-launch-not-tried first-launch-center">
                {t('firstLaunch.finishNotTried', { hotkey: formatHotkey(hotkey) })}
              </p>
            )}

            <section className="first-launch-section">
              <h2 className="first-launch-section-label">{t('firstLaunch.startupLabel')}</h2>
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
                {!isStore && (
                  <label className="auto-launch-checkbox-label update-check-checkbox-label">
                    <input
                      type="checkbox"
                      checked={updateCheckEnabled}
                      onChange={(e) => setUpdateCheckEnabled(e.target.checked)}
                      disabled={isLoading}
                      className="update-check-checkbox"
                      data-testid="first-launch-update-check"
                    />
                    {t('firstLaunch.updateCheck')}
                  </label>
                )}
                {portableModeAvailable && (
                  <label className="auto-launch-checkbox-label portable-mode-checkbox-label">
                    <input
                      type="checkbox"
                      checked={portableMode}
                      onChange={(e) => setPortableMode(e.target.checked)}
                      disabled={isLoading}
                      className="portable-mode-checkbox"
                      data-testid="first-launch-portable-mode"
                    />
                    {t('firstLaunch.portableMode')}
                  </label>
                )}
              </div>
              <p className="first-launch-change-later">
                {t(
                  portableModeAvailable
                    ? 'firstLaunch.changeLaterExceptPortable'
                    : 'firstLaunch.changeLater'
                )}
              </p>
            </section>

            <section className="first-launch-section">
              <h2 className="first-launch-section-label">{t('firstLaunch.gettingStartedLabel')}</h2>
              <ul className="first-launch-getting-started">
                <li>{t('firstLaunch.gettingStartedSamples')}</li>
                <li>{t('firstLaunch.gettingStartedAdd')}</li>
              </ul>
            </section>

            {saveFailed && (
              <p className="validation-error first-launch-center" role="alert">
                {t('firstLaunch.saveFailed')}
              </p>
            )}

            <div className="first-launch-actions first-launch-actions-split">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setStep('try')}
                disabled={isLoading}
              >
                {t('firstLaunch.back')}
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={handleComplete}
                disabled={isLoading || !isValid}
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
