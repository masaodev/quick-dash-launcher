import React from 'react';

const AdminOtherTab: React.FC = () => {
  const handleOpenConfigFolder = () => {
    window.electronAPI.openConfigFolder();
  };

  const handleOpenDataFile = () => {
    window.electronAPI.openDataFile();
  };


  const handleQuitApp = () => {
    if (confirm('アプリケーションを終了しますか？')) {
      window.electronAPI.quitApp();
    }
  };

  const getVersionInfo = () => {
    return process.env.NODE_ENV === 'development' ? 'Development' : 'Production';
  };

  return (
    <div className="admin-other-tab">
      <div className="other-content">
        <div className="section">
          <h3>ファイル管理</h3>
          <div className="action-buttons">
            <button onClick={handleOpenConfigFolder} className="action-button">
              📁 設定フォルダを開く
            </button>
            <button onClick={handleOpenDataFile} className="action-button">
              📄 データファイルを開く
            </button>
          </div>
        </div>

        <div className="section">
          <h3>システム情報</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>バージョン:</label>
              <span>1.0.0</span>
            </div>
            <div className="info-item">
              <label>ビルド:</label>
              <span>{getVersionInfo()}</span>
            </div>
            <div className="info-item">
              <label>プラットフォーム:</label>
              <span>Windows</span>
            </div>
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
