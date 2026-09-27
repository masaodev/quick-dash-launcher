import React from 'react';
import type { DataFileTab } from '@common/types';

import { useDropdown } from '../hooks/useDropdown';

interface AdminItemManagerHeaderProps {
  dataFileTabs: DataFileTab[];
  selectedTabIndex: number;
  currentTabFiles: string[];
  selectedDataFile: string;
  getFileLabel: (fileName: string) => string;
  onSelectTab: (tabIndex: number) => void;
  onSelectFile: (fileName: string) => void;
  onOpenBookmarkImport: () => void;
  onOpenAppImport: () => void;
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

/** アイテム管理のヘッダー: 編集対象のタブ・データファイルの選択、一括取り込み、ツールメニュー */
const AdminItemManagerHeader: React.FC<AdminItemManagerHeaderProps> = ({
  dataFileTabs,
  selectedTabIndex,
  currentTabFiles,
  selectedDataFile,
  getFileLabel,
  onSelectTab,
  onSelectFile,
  onOpenBookmarkImport,
  onOpenAppImport,
  onCheckMissingPaths,
  checkingMissingPaths,
  missingOnly,
  missingOnlyAvailable,
  onToggleMissingOnly,
  onDedupe,
}) => {
  const tabDropdown = useDropdown();
  const fileDropdown = useDropdown();
  const importDropdown = useDropdown();
  const toolsDropdown = useDropdown();
  const currentTab = dataFileTabs[selectedTabIndex];

  return (
    <div className="edit-mode-header">
      <div className="edit-mode-info">
        <div className="tab-dropdown" ref={tabDropdown.ref}>
          <label className="dropdown-label">タブ:</label>
          <button
            className="dropdown-trigger-btn"
            onClick={tabDropdown.toggle}
            title={currentTab?.name || 'タブ選択'}
          >
            <span className="dropdown-trigger-text">{currentTab?.name || 'タブ選択'}</span>
            <span className="dropdown-trigger-icon">{tabDropdown.isOpen ? '▲' : '▼'}</span>
          </button>
          {tabDropdown.isOpen && (
            <div className="dropdown-menu">
              {dataFileTabs.map((tab, index) => (
                <button
                  key={index}
                  className={`dropdown-item ${selectedTabIndex === index ? 'selected' : ''}`}
                  onClick={() => {
                    tabDropdown.close();
                    onSelectTab(index);
                  }}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {currentTabFiles.length > 1 && (
          <div className="file-dropdown" ref={fileDropdown.ref}>
            <label className="dropdown-label">データファイル:</label>
            <button
              className="dropdown-trigger-btn"
              onClick={fileDropdown.toggle}
              title={`${getFileLabel(selectedDataFile)} (${selectedDataFile})`}
            >
              <span className="dropdown-trigger-text">{getFileLabel(selectedDataFile)}</span>
              <span className="dropdown-trigger-icon">{fileDropdown.isOpen ? '▲' : '▼'}</span>
            </button>
            {fileDropdown.isOpen && (
              <div className="dropdown-menu">
                {currentTabFiles.map((fileName) => (
                  <button
                    key={fileName}
                    className={`dropdown-item ${selectedDataFile === fileName ? 'selected' : ''}`}
                    onClick={() => {
                      fileDropdown.close();
                      onSelectFile(fileName);
                    }}
                    title={fileName}
                  >
                    {getFileLabel(fileName)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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
