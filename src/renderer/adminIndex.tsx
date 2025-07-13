import React from 'react';
import ReactDOM from 'react-dom/client';

import AdminApp from './AdminApp';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('admin-root') as HTMLElement);

root.render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
