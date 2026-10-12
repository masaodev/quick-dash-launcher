import React from 'react';

import { useDropdown } from '../hooks/useDropdown';

interface AdminItemManagerHeaderProps {
  onOpenBookmarkImport: () => void;
  onOpenAppImport: () => void;
  /** 一括取込メニュー: 設定「ブックマーク自動取込」を開く */
  onOpenAutoImportSettings?: () => void;
  /** ツールメニュー: リンク切れの確認（押したときだけ確認する） */
  onCheckMissingPaths: () => void;
  checkingMissingPaths: boolean;
  /** ツールメニュー: リンク切れのみ表示（確認した後だけ選べる） */
  missingOnly: boolean;
  missingOnlyAvailable: boolean;
  onToggleMissingOnly: () => void;
  /** ツールメニュー: 重複を削除 */
  onDedupe: () => void;
}

/** アイテム管理のヘッダー: 一括取り込み、ツールメニュー（タブ・データファイルの選択は AdminItemManagerTabBar） */
const AdminItemManagerHeader: React.FC<AdminItemManagerHeaderProps> = ({
  onOpenBookmarkImport,
  onOpenAppImport,
  onOpenAutoImportSettings,
  onCheckMissingPaths,
  checkingMissingPaths,
  missingOnly,
  missingOnlyAvailable,
  onToggleMissingOnly,
  onDedupe,
}) => {
  const importDropdown = useDropdown();
  const toolsDropdown = useDropdown();

  return (
    <div className="edit-mode-header">
      <div className="edit-mode-info">
        <div className="import-dropdown" ref={importDropdown.ref}>
          <button className="dropdown-trigger-btn" onClick={importDropdown.toggle}>
            <span className="dropdown-trigger-text">アイテムを一括取り込み</span>
            <span className="dropdown-trigger-icon">{importDropdown.isOpen ? '▲' : '▼'}</span>
          </button>
          {importDropdown.isOpen && (
            <div className="dropdown-menu">
              <button
                className="dropdown-item"
                onClick={() => {
                  importDropdown.close();
                  onOpenBookmarkImport();
                }}
              >
                ブラウザのブックマークを追加
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  importDropdown.close();
                  onOpenAppImport();
                }}
              >
                インストール済みアプリを追加
              </button>
              {onOpenAutoImportSettings && (
                <button
                  className="dropdown-item"
                  onClick={() => {
                    importDropdown.close();
                    onOpenAutoImportSettings();
                  }}
                  title="ブラウザのブックマークを、ルールに従って起動時などに自動で取り込む設定"
                >
                  ブックマーク自動取込の設定…
                </button>
              )}
            </div>
          )}
        </div>
        <div className="import-dropdown tools-dropdown" ref={toolsDropdown.ref}>
          <button
            className="dropdown-trigger-btn"
            onClick={toolsDropdown.toggle}
            title="一覧全体に対する補助機能（リンク切れの確認、重複の削除）"
          >
            <span className="dropdown-trigger-text">🧰 ツール</span>
            <span className="dropdown-trigger-icon">{toolsDropdown.isOpen ? '▲' : '▼'}</span>
          </button>
          {toolsDropdown.isOpen && (
            <div className="dropdown-menu">
              <button
                className="dropdown-item"
                disabled={checkingMissingPaths}
                onClick={() => {
                  toolsDropdown.close();
                  onCheckMissingPaths();
                }}
                title="表示中のデータファイルのローカルパスが実在するかを確認します（URL・shell:・コマンド名は対象外。押したときだけ確認します）"
              >
                {checkingMissingPaths ? '🔍 確認中...' : '🔍 リンク切れを確認'}
              </button>
              <button
                className={`dropdown-item ${missingOnly ? 'selected' : ''}`}
                disabled={!missingOnlyAvailable}
                onClick={() => {
                  toolsDropdown.close();
                  onToggleMissingOnly();
                }}
                title={
                  missingOnlyAvailable
                    ? 'パスが見つからなかったアイテムだけを表示します'
                    : '先に「リンク切れを確認」を実行してください'
                }
              >
                {missingOnly ? '☑' : '☐'} リンク切れのみ表示
              </button>
              <button
                className="dropdown-item"
                onClick={() => {
                  toolsDropdown.close();
                  onDedupe();
                }}
                title="種類・名前・パスが同じアイテムを、先にある 1 件を残して削除します"
              >
                🧹 重複を削除
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminItemManagerHeader;
