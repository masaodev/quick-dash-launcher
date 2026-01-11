import React from 'react';
import ReactDOM from 'react-dom/client';

import WorkspaceApp from '../WorkspaceApp';
import '../styles/index.css';
import '../styles/components/WorkspaceWindow.css';
import '../styles/components/LauncherContextMenu.css';
import '../styles/components/ColorPicker.css';

const rootElement = document.getElementById('workspace-root');
if (!rootElement) {
  throw new Error('Workspace root element not found');
}
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <WorkspaceApp />
  </React.StrictMode>
);
