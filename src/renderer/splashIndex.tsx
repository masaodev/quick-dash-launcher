import React from 'react';
import ReactDOM from 'react-dom/client';

import SplashApp from './SplashApp';
import './styles/splash.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

const handleReady = () => {
  // Notify main process that splash screen has completed
  window.electronAPI?.splashReady?.();
};

root.render(
  <React.StrictMode>
    <SplashApp onReady={handleReady} />
  </React.StrictMode>
);
