import React, { useEffect, useState } from 'react';
import { AppInfo } from '@common/types';

const AdminOtherTab: React.FC = () => {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    const loadAppInfo = async () => {
      const info = await window.electronAPI.getAppInfo();
      setAppInfo(info);
    };
    loadAppInfo();
  }, []);

  const handleOpenConfigFolder = () => {
    window.electronAPI.openConfigFolder();
  };

  const handleQuitApp = () => {
    if (confirm('アプリケーションを終了しますか？')) {
      window.electronAPI.quitApp();
    }
  };

  const handleOpenGitHub = () => {
    if (appInfo?.repository) {
      window.electronAPI.openExternalUrl(appInfo.repository);
    }
  };

  return (
    <div className="admin-other-tab">
      <div className="other-content">
        <div className="section">
          <h3>ファイル管理</h3>
          <div className="action-buttons">
            <button onClick={handleOpenConfigFolder} className="section-action-button">
              📁 設定フォルダを開く
            </button>
          </div>
        </div>

        <div className="section">
          <h3>アプリケーション情報</h3>
          <div className="app-info-row">
            <div className="info-text">
              バージョン: {appInfo?.version || '読込中...'} ・ ライセンス:{' '}
              {appInfo?.license || '読込中...'}
            </div>
            <button onClick={handleOpenGitHub} className="link-button" disabled={!appInfo}>
              🔗 GitHubリポジトリ
            </button>
          </div>
        </div>

        <div className="section">
          <h3>ショートカット一覧</h3>
          <div className="shortcuts-list">
            <div className="shortcut-item">
              <kbd>Ctrl + Alt + W</kbd>
              <span>メインウィンドウの表示/非表示</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl + E</kbd>
              <span>管理ウィンドウの表示/非表示</span>
            </div>
            <div className="shortcut-item">
              <kbd>Enter</kbd>
              <span>選択したアイテムを開く</span>
            </div>
            <div className="shortcut-item">
              <kbd>Shift + Enter</kbd>
              <span>選択したアイテムの親フォルダを開く</span>
            </div>
            <div className="shortcut-item">
              <kbd>↑ / ↓</kbd>
              <span>アイテムを選択</span>
            </div>
            <div className="shortcut-item">
              <kbd>Tab / Shift + Tab</kbd>
              <span>タブを切り替え（タブ表示有効時）</span>
            </div>
            <div className="shortcut-item">
              <kbd>Esc</kbd>
              <span>ウィンドウを閉じる</span>
            </div>
          </div>
        </div>

        <div className="section">
          <h3>アプリケーション</h3>
          <div className="app-actions">
            <button onClick={handleQuitApp} className="quit-button">
              🚪 アプリケーションを終了
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOtherTab;
