import React, { useEffect, useState } from 'react';
import { AppInfo } from '@common/types';

import { Button } from './ui/Button';

/** 設定のホットキー（"Alt+Space"）を表示用（"Alt + Space"）にする */
function formatHotkey(hotkey: string): string {
  return hotkey.split('+').join(' + ');
}

const AdminOtherTab: React.FC = () => {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [hotkeys, setHotkeys] = useState<{ launch: string; itemSearch: string }>({
    launch: '',
    itemSearch: '',
  });

  useEffect(() => {
    const loadAppInfo = async () => {
      const info = await window.electronAPI.getAppInfo();
      setAppInfo(info);
    };
    loadAppInfo();
  }, []);

  // ショートカット一覧のホットキーは設定の値を表示する（設定が変わったら読み直す）
  useEffect(() => {
    const loadHotkeys = async () => {
      const settings = await window.electronAPI.getSettings();
      setHotkeys({ launch: settings.hotkey, itemSearch: settings.itemSearchHotkey });
    };
    loadHotkeys();
    return window.electronAPI.onSettingsChanged(loadHotkeys);
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
      <div className="help-content">
        {/* キーボードショートカット - 最上部に大きく表示 */}
        <div className="help-section help-section-shortcuts">
          <h3>⌨️ キーボードショートカット</h3>
          <div className="shortcuts-grid">
            <div className="shortcut-item">
              <kbd>{hotkeys.launch ? formatHotkey(hotkeys.launch) : '（未設定）'}</kbd>
              <span>メインウィンドウの表示/非表示</span>
            </div>
            {hotkeys.itemSearch && (
              <div className="shortcut-item">
                <kbd>{formatHotkey(hotkeys.itemSearch)}</kbd>
                <span>ウィンドウ検索で起動</span>
              </div>
            )}
            <div className="shortcut-item">
              <kbd>Ctrl + E</kbd>
              <span>管理ウィンドウの表示/非表示（メイン画面で）</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl + W</kbd>
              <span>ワークスペースの表示/非表示（メイン画面で）</span>
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
              <kbd>Tab</kbd>
              <span>タブを切り替え（タブ表示有効時）</span>
            </div>
            <div className="shortcut-item">
              <kbd>Shift + Tab</kbd>
              <span>検索モードを切り替え（通常 / ウィンドウ）</span>
            </div>
            <div className="shortcut-item">
              <kbd>F5</kbd>
              <span>再読込</span>
            </div>
            <div className="shortcut-item">
              <kbd>Esc</kbd>
              <span>メインウィンドウを閉じる</span>
            </div>
          </div>
        </div>

        {/* 2カラムエリア */}
        <div className="help-cards">
          {/* アプリについて */}
          <div className="help-card">
            <h3>ℹ️ アプリについて</h3>
            <div className="help-card-content">
              <div className="app-info-details">
                <div className="app-info-item">
                  <span className="app-info-label">バージョン</span>
                  <span className="app-info-value">{appInfo?.version || '読込中...'}</span>
                </div>
                <div className="app-info-item">
                  <span className="app-info-label">ライセンス</span>
                  <span className="app-info-value">{appInfo?.license || '読込中...'}</span>
                </div>
              </div>
              <Button variant="info" onClick={handleOpenGitHub} disabled={!appInfo}>
                🔗 GitHub
              </Button>
            </div>
          </div>

          {/* データ管理 */}
          <div className="help-card">
            <h3>📁 データ管理</h3>
            <div className="help-card-content">
              <p className="help-card-description">
                設定ファイルやデータファイルが保存されているフォルダを開きます。
              </p>
              <Button variant="info" onClick={handleOpenConfigFolder}>
                📂 設定フォルダを開く
              </Button>
              <p className="help-card-description">
                AI エージェントにデータファイルを編集させるときは、このフォルダの README.md
                を読ませてください（編集の作法・反映方法・結果の確認先が書いてあります）。
              </p>
            </div>
          </div>
        </div>

        {/* 終了ボタン - 下部に分離 */}
        <div className="help-footer">
          <Button variant="danger" onClick={handleQuitApp}>
            🚪 アプリケーションを終了
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminOtherTab;
