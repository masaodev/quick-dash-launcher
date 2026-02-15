import React, { useEffect, useRef, useState } from 'react';

const MIN_DISPLAY_TIME = 600; // 最低表示時間（ms）
const COMPLETION_DISPLAY_TIME = 150; // 完了表示後の待機時間（ms）
const FALLBACK_TIMEOUT = 5000; // フォールバックタイムアウト（ms）

interface SplashAppProps {
  onReady?: () => void;
}

function SplashApp({ onReady }: SplashAppProps): React.ReactElement {
  const [loadingText, setLoadingText] = useState('起動中');
  const [progress, setProgress] = useState(0);

  const initCompleteRef = useRef(false);
  const minTimeElapsedRef = useRef(false);
  const hasCalledReadyRef = useRef(false);

  useEffect(() => {
    const tryFinish = () => {
      if (hasCalledReadyRef.current) return;
      if (!initCompleteRef.current || !minTimeElapsedRef.current) return;

      hasCalledReadyRef.current = true;
      setLoadingText('初期化完了');
      setProgress(100);

      setTimeout(() => {
        onReady?.();
      }, COMPLETION_DISPLAY_TIME);
    };

    // 短縮アニメーション（450ms間で進捗を表示）
    const animSteps = [
      { delay: 100, text: '起動中', progress: 20 },
      { delay: 250, text: '設定を読み込み中', progress: 50 },
      { delay: 450, text: 'アプリケーションを準備中', progress: 75 },
    ];

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
      <p className="app-subtitle">素早いアクセスを実現するランチャーアプリ</p>

      <div className="loading-container">
        <div className="loading-bar">
          <div className="loading-progress" style={{ width: `${progress}%`, animation: 'none' }} />
        </div>
        <div className="loading-text">
          {loadingText}
          <span className="loading-dots">...</span>
        </div>
      </div>
    </div>
  );
}

export default SplashApp;
