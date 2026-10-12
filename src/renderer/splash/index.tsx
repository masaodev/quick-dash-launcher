import React from 'react';
import ReactDOM from 'react-dom/client';

import SplashApp from '../SplashApp';
import { initRendererI18n } from '../i18n';
import '../styles/splash.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
const root = ReactDOM.createRoot(rootElement);

const handleReady = () => {
  // Notify main process that splash screen has completed
  window.electronAPI?.splashReady?.();
};

void initRendererI18n().then(() => {
  root.render(
    <React.StrictMode>
      <SplashApp onReady={handleReady} />
    </React.StrictMode>
  );
});
