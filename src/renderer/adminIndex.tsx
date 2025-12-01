import React from 'react';
import ReactDOM from 'react-dom/client';

import AdminApp from './AdminApp';
import './styles/index.css';
import './styles/components/AdminWindow.css';
import './styles/components/EditMode.css';
import './styles/components/Modal.css';
import './styles/components/RegisterModal.css';
import './styles/components/BookmarkImport.css';
import './styles/components/IconProgress.css';
import './styles/components/FilePickerDialog.css';
import './styles/components/AlertDialog.css';
import './styles/components/ConfirmDialog.css';

const root = ReactDOM.createRoot(document.getElementById('admin-root') as HTMLElement);

root.render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
