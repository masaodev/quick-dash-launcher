import React from 'react';
import ReactDOM from 'react-dom/client';
import { MAIN_CHILD_WINDOW_NAME_PREFIX } from '@common/constants';

import App from './App';
import MainChildPage from './components/MainChildPage';
import { ToastProvider } from './components/ToastProvider';
import './styles/index.css';
import './styles/components/Header.css';
import './styles/components/LauncherItemList.css';
import './styles/components/AdminItemManager.css';
import './styles/components/Modal.css';
import './styles/components/RegisterModal.css';
import './styles/components/BookmarkImport.css';
import './styles/components/AppImport.css';
// 子ウィンドウ（アイテムの登録・編集、アイコン取得結果）用のスタイル
import './styles/components/MainChildPage.css';

/**
 * メイン画面の子ウィンドウとして開かれたときの requestId
 * 通常は window.name（メイン画面から window.open で開かれた場合）、
 * メインプロセスが直接生成したフォールバック時は URL クエリから読む
 */
function getChildRequestIdFromWindow(): string | null {
  if (window.name.startsWith(MAIN_CHILD_WINDOW_NAME_PREFIX)) {
    const id = window.name.slice(MAIN_CHILD_WINDOW_NAME_PREFIX.length);
    if (id) return id;
  }
  return new URLSearchParams(window.location.search).get('childRequestId');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
const root = ReactDOM.createRoot(rootElement);
const childRequestId = getChildRequestIdFromWindow();

root.render(
  <React.StrictMode>
    <ToastProvider position="bottom-right">
      {childRequestId ? <MainChildPage requestId={childRequestId} /> : <App />}
    </ToastProvider>
  </React.StrictMode>
);
