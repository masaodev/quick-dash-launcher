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
}

/** アイテム管理のヘッダー: 編集対象のタブ・データファイルの選択と一括取り込み */
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
}) => {
  const tabDropdown = useDropdown();
  const fileDropdown = useDropdown();
  const importDropdown = useDropdown();
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
      </div>
    </div>
  );
};

export default AdminItemManagerHeader;
