import React from 'react';
import ReactDOM from 'react-dom/client';

import AdminApp from '../AdminApp';
import { initRendererI18n } from '../i18n';
import { ToastProvider } from '../components/ToastProvider';
import '../styles/index.css';
import '../styles/components/AdminWindow.css';
import '../styles/components/AdminItemManager.css';
import '../styles/components/Modal.css';
import '../styles/components/RegisterModal.css';
import '../styles/components/BookmarkImport.css';
import '../styles/components/ImportModal.css';
import '../styles/components/AppImport.css';
import '../styles/components/LauncherIconProgress.css';
import '../styles/components/FilePickerDialog.css';
import '../styles/components/AlertDialog.css';
import '../styles/components/ConfirmDialog.css';

const rootElement = document.getElementById('admin-root');
if (!rootElement) {
  throw new Error('Admin root element not found');
}
const root = ReactDOM.createRoot(rootElement);

void initRendererI18n().then(() => {
  root.render(
    <React.StrictMode>
      {/* アイテム管理の下の件数の帯（合計・入力不備・リンク切れ）に重ならないよう、その分上げる */}
      <ToastProvider
        position="bottom-right"
        bottomOffset="calc(var(--spacing-lg) + var(--admin-status-bar-height))"
      >
        <AdminApp />
      </ToastProvider>
    </React.StrictMode>
  );
});
