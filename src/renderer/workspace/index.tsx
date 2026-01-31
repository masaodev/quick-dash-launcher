import React from 'react';
import ReactDOM from 'react-dom/client';

import WorkspaceApp from '../WorkspaceApp';
import { ToastProvider } from '../components/ToastProvider';
import '../styles/index.css';
import '../styles/components/WorkspaceWindow.css';
import '../styles/components/ColorPicker.css';
// WorkspaceItemEditModal 用のスタイル
import '../styles/components/Modal.css';
import '../styles/components/RegisterModal.css';
import '../styles/components/Button.css';
import '../styles/components/WindowSelectorModal.css';
import '../styles/components/ConfirmDialog.css';
import '../styles/components/GlobalLoadingIndicator.css';

const rootElement = document.getElementById('workspace-root');
if (!rootElement) {
  throw new Error('Workspace root element not found');
}
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ToastProvider position="bottom-right">
      <WorkspaceApp />
    </ToastProvider>
  </React.StrictMode>
);
