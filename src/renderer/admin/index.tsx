import React from 'react';
import ReactDOM from 'react-dom/client';

import AdminApp from '../AdminApp';
import '../styles/index.css';
import '../styles/components/AdminWindow.css';
import '../styles/components/AdminItemManager.css';
import '../styles/components/AdminArchiveTab.css';
import '../styles/components/Modal.css';
import '../styles/components/RegisterModal.css';
import '../styles/components/BookmarkImport.css';
import '../styles/components/LauncherIconProgress.css';
import '../styles/components/FilePickerDialog.css';
import '../styles/components/AlertDialog.css';
import '../styles/components/ConfirmDialog.css';

const rootElement = document.getElementById('admin-root');
if (!rootElement) {
  throw new Error('Admin root element not found');
}
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
