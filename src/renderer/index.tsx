import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { ToastProvider } from './components/ToastProvider';
import './styles/index.css';
import './styles/components/Header.css';
import './styles/components/LauncherItemList.css';
import './styles/components/AdminItemManager.css';
import './styles/components/Modal.css';
import './styles/components/RegisterModal.css';
import './styles/components/BookmarkImport.css';
import './styles/components/AppImport.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ToastProvider position="bottom-right">
      <App />
    </ToastProvider>
  </React.StrictMode>
);
