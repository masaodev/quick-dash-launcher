import React from 'react';

interface FileTabBarProps {
  /** 利用可能なデータファイル名のリスト */
  dataFiles: string[];
  /** 現在アクティブなタブ（ファイル名） */
  activeTab: string;
  /** タブ名のカスタマイズマッピング */
  tabNames: Record<string, string>;
  /** タブクリック時のハンドラ */
  onTabClick: (fileName: string) => void;
}

/**
 * メインウィンドウのデータファイルタブバーコンポーネント
 * 複数のdata*.txtファイルをタブで切り替え可能にする
 */
const FileTabBar: React.FC<FileTabBarProps> = ({ dataFiles, activeTab, tabNames, onTabClick }) => {
  // タブに表示する名前を取得（カスタム名がなければファイル名をそのまま表示）
  const getTabLabel = (fileName: string): string => {
    return tabNames[fileName] || fileName;
  };

  return (
    <div className="file-tab-bar">
      {dataFiles.map((fileName) => (
        <button
          key={fileName}
          className={`file-tab ${activeTab === fileName ? 'active' : ''}`}
          onClick={() => onTabClick(fileName)}
          title={fileName}
        >
          {getTabLabel(fileName)}
        </button>
      ))}
    </div>
  );
};

export default FileTabBar;
