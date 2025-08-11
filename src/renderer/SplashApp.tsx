import React, { useEffect, useState } from 'react';

interface SplashAppProps {
  onReady?: () => void;
}

const SplashApp: React.FC<SplashAppProps> = ({ onReady }) => {
  const [loadingText, setLoadingText] = useState('起動中');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate startup progress
    const steps = [
      { delay: 100, text: '起動中', progress: 10 },
      { delay: 300, text: '設定を読み込み中', progress: 25 },
      { delay: 500, text: 'ディレクトリを準備中', progress: 40 },
      { delay: 700, text: 'データファイルを読み込み中', progress: 60 },
      { delay: 900, text: 'アイコンを準備中', progress: 80 },
      { delay: 1100, text: '初期化完了', progress: 100 },
    ];

    let timeouts: NodeJS.Timeout[] = [];

    steps.forEach((step) => {
      const timeout = setTimeout(() => {
        setLoadingText(step.text);
        setProgress(step.progress);
        
        if (step.progress === 100 && onReady) {
          setTimeout(() => {
            onReady();
          }, 300);
        }
      }, step.delay);
      
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [onReady]);

  return (
    <div className="splash-container">
      <div className="app-logo">Q</div>
      <h1 className="app-title">QuickDashLauncher</h1>
      <p className="app-subtitle">素早いアクセスを実現するランチャーアプリ</p>
      
      <div className="loading-container">
        <div className="loading-bar">
          <div 
            className="loading-progress" 
            style={{ width: `${progress}%`, animation: 'none' }}
          />
        </div>
        <div className="loading-text">
          {loadingText}
          <span className="loading-dots">...</span>
        </div>
      </div>
    </div>
  );
};

export default SplashApp;