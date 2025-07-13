import React from 'react';
import ReactDOM from 'react-dom/client';

import EditApp from './EditApp';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('edit-root') as HTMLElement);

root.render(
  <React.StrictMode>
    <EditApp />
  </React.StrictMode>
);