import React from 'react';
import { AppItem } from '../../common/types';
import { filterItems } from '../utils/dataParser';

interface FileTabBarProps {
  /** 利用可能なデータファイル名のリスト */
  dataFiles: string[];
  /** 現在アクティブなタブ（ファイル名） */
  activeTab: string;
  /** タブ名のカスタマイズマッピング */
  tabNames: Record<string, string>;
  /** タブクリック時のハンドラ */
  onTabClick: (fileName: string) => void;
  /** 全アイテム（各タブのアイテム数計算用） */
  allItems: AppItem[];
  /** 検索クエリ（フィルタリング用） */
  searchQuery: string;
}

/**
 * メインウィンドウのデータファイルタブバーコンポーネント
 * 複数のdata*.txtファイルをタブで切り替え可能にする
 */
const FileTabBar: React.FC<FileTabBarProps> = ({
  dataFiles,
  activeTab,
  tabNames,
  onTabClick,
  allItems,
  searchQuery,
}) => {
  // デフォルトのタブ名を生成（data.txt→メイン, data2.txt→サブ1, data3.txt→サブ2, ...）
  const getDefaultTabName = (fileName: string): string => {
    if (fileName === 'data.txt') {
      return 'メイン';
    }
    const match = fileName.match(/^data(\d+)\.txt$/);
    if (match) {
      const num = parseInt(match[1]);
      return `サブ${num - 1}`;
    }
    return fileName;
  };

  // タブに表示する名前を取得（カスタム名 > デフォルト名 > ファイル名）
  const getTabLabel = (fileName: string): string => {
    return tabNames[fileName] || getDefaultTabName(fileName);
  };

  // 各タブのアイテム数を計算
  const getTabItemCount = (fileName: string): number => {
    const tabItems = allItems.filter((item) => item.sourceFile === fileName);
    const filteredTabItems = filterItems(tabItems, searchQuery);
    return filteredTabItems.length;
  };

  return (
    <div className="file-tab-bar">
      {dataFiles.map((fileName) => {
        const count = getTabItemCount(fileName);
        return (
          <button
            key={fileName}
            className={`file-tab ${activeTab === fileName ? 'active' : ''}`}
            onClick={() => onTabClick(fileName)}
            title={fileName}
          >
            <span className="file-tab-label">{getTabLabel(fileName)}</span>
            <span className="file-tab-count">({count})</span>
          </button>
        );
      })}
    </div>
  );
};

export default FileTabBar;
