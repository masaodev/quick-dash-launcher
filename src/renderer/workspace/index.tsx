import React from 'react';
import ReactDOM from 'react-dom/client';
import { WORKSPACE_EDITOR_WINDOW_NAME_PREFIX } from '@common/constants';

import WorkspaceApp from '../WorkspaceApp';
import WorkspaceItemEditPage from '../components/WorkspaceItemEditPage';
import { ToastProvider } from '../components/ToastProvider';
import '../styles/index.css';
import '../styles/components/WorkspaceWindow.css';
import '../styles/components/ColorPicker.css';
// 編集ウィンドウ（WorkspaceItemEditPage / WorkspaceItemEditModal）用のスタイル
import '../styles/components/Modal.css';
import '../styles/components/RegisterModal.css';
import '../styles/components/Button.css';
import '../styles/components/WindowSelectorModal.css';
import '../styles/components/ConfirmDialog.css';
import '../styles/components/WorkspaceEditorPage.css';

/**
 * 編集ウィンドウとして開かれたときの itemId
 * 通常は window.name（ワークスペースから window.open で開かれた場合）、
 * メインプロセスが直接生成したフォールバック時は URL クエリから読む
 */
function getEditorItemIdFromWindow(): string | null {
  if (window.name.startsWith(WORKSPACE_EDITOR_WINDOW_NAME_PREFIX)) {
    const id = window.name.slice(WORKSPACE_EDITOR_WINDOW_NAME_PREFIX.length);
    if (id) return id;
  }
  return new URLSearchParams(window.location.search).get('editItemId');
}

const rootElement = document.getElementById('workspace-root');
if (!rootElement) {
  throw new Error('Workspace root element not found');
}
const root = ReactDOM.createRoot(rootElement);
const editorItemId = getEditorItemIdFromWindow();

root.render(
  <React.StrictMode>
    <ToastProvider position="bottom-right">
      {editorItemId ? <WorkspaceItemEditPage itemId={editorItemId} /> : <WorkspaceApp />}
    </ToastProvider>
  </React.StrictMode>
);
