import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const MIN_DISPLAY_TIME = 600; // 最低表示時間（ms）
const COMPLETION_DISPLAY_TIME = 150; // 完了表示後の待機時間（ms）
const FALLBACK_TIMEOUT = 30000; // フォールバックタイムアウト（ms）

/** 起動中に出す段階（文言は辞書の splash.*） */
type SplashStep = 'starting' | 'loadingSettings' | 'preparing' | 'ready';

interface SplashAppProps {
  onReady?: () => void;
}

function SplashApp({ onReady }: SplashAppProps): React.ReactElement {
  const { t } = useTranslation();
  const [loadingText, setLoadingText] = useState<SplashStep>('starting');
  const [progress, setProgress] = useState(0);

  const initCompleteRef = useRef(false);
  const minTimeElapsedRef = useRef(false);
  const hasCalledReadyRef = useRef(false);

  // splash.html の <title> は日本語なので、表示言語のタイトルに差し替える
  useEffect(() => {
    document.title = t('splash.windowTitle');
  }, [t]);

  useEffect(() => {
    const tryFinish = () => {
      if (hasCalledReadyRef.current) return;
      if (!initCompleteRef.current || !minTimeElapsedRef.current) return;

      hasCalledReadyRef.current = true;
      setLoadingText('ready');
      setProgress(100);

      setTimeout(() => {
        onReady?.();
      }, COMPLETION_DISPLAY_TIME);
    };

    // 短縮アニメーション（450ms間で進捗を表示）
    const animSteps = [
      { delay: 100, text: 'starting', progress: 20 },
      { delay: 250, text: 'loadingSettings', progress: 50 },
      { delay: 450, text: 'preparing', progress: 75 },
    ] as const;

    const timeouts: ReturnType<typeof setTimeout>[] = [];

    animSteps.forEach((step) => {
      timeouts.push(
        setTimeout(() => {
          if (!hasCalledReadyRef.current) {
            setLoadingText(step.text);
            setProgress(step.progress);
          }
        }, step.delay)
      );
    });

    // 最低表示時間タイマー
    timeouts.push(
      setTimeout(() => {
        minTimeElapsedRef.current = true;
        tryFinish();
      }, MIN_DISPLAY_TIME)
    );

    // フォールバックタイムアウト（初期化完了通知が来ない場合の安全策）
    timeouts.push(
      setTimeout(() => {
        if (!hasCalledReadyRef.current) {
          initCompleteRef.current = true;
          minTimeElapsedRef.current = true;
          tryFinish();
        }
      }, FALLBACK_TIMEOUT)
    );

    // メインプロセスからの初期化完了通知を待ち受け
    const offSplashInitComplete = window.electronAPI.onSplashInitComplete(() => {
      initCompleteRef.current = true;
      tryFinish();
    });

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      offSplashInitComplete();
    };
  }, [onReady]);

  return (
    <div className="splash-container">
      <div className="app-logo">Q</div>
      <h1 className="app-title">QuickDashLauncher</h1>
      <p className="app-subtitle">{t('splash.subtitle')}</p>

      <div className="loading-container">
        <div className="loading-bar">
          <div className="loading-progress" style={{ width: `${progress}%`, animation: 'none' }} />
        </div>
        <div className="loading-text">
          {t(`splash.${loadingText}`)}
          <span className="loading-dots">...</span>
        </div>
      </div>
    </div>
  );
}

export default SplashApp;
