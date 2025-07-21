import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './styles/index.css';
import './styles/components/Header.css';
import './styles/components/ItemList.css';
import './styles/components/EditMode.css';
import './styles/components/Modal.css';
import './styles/components/RegisterModal.css';
import './styles/components/BookmarkImport.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
