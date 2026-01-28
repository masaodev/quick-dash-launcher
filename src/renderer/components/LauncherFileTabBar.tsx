import React from 'react';
import { AppItem, DataFileTab } from '@common/types';
import { isWindowInfo } from '@common/types/guards';

import { filterItems } from '../utils/dataParser';

interface FileTabBarProps {
  /** データファイルタブの設定（タブグループのリスト） */
  dataFileTabs: DataFileTab[];
  /** 現在アクティブなタブ（ファイル名） */
  activeTab: string;
  /** タブクリック時のハンドラ（タブグループの最初のファイル名を渡す） */
  onTabClick: (fileName: string) => void;
  /** 全アイテム（各タブのアイテム数計算用） */
  allItems: AppItem[];
  /** 検索クエリ（フィルタリング用） */
  searchQuery: string;
  /** データファイルのラベル定義（物理ファイル名 → 表示ラベル） */
  dataFileLabels?: Record<string, string>;
}

/**
 * メインウィンドウのデータファイルタブバーコンポーネント
 * 複数のdata*.jsonファイルをタブで切り替え可能にする
 * 1つのタブに複数のデータファイルを紐付けることが可能
 */
const LauncherFileTabBar: React.FC<FileTabBarProps> = ({
  dataFileTabs,
  activeTab,
  onTabClick,
  allItems,
  searchQuery,
  dataFileLabels = {},
}) => {
  // データファイル名を取得（設定がない場合は物理ファイル名）
  const getFileLabel = (fileName: string): string => {
    return dataFileLabels[fileName] || fileName;
  };

  // 各タブグループのアイテム数を計算
  const getTabItemCount = (tabConfig: DataFileTab): number => {
    // タブに紐付く全ファイルのアイテムを取得
    const tabItems = allItems.filter(
      (item) => !isWindowInfo(item) && tabConfig.files.includes(item.sourceFile || '')
    );
    const filteredTabItems = filterItems(tabItems, searchQuery);
    return filteredTabItems.length;
  };

  // タブグループがアクティブかどうかを判定
  const isTabActive = (tabConfig: DataFileTab): boolean => {
    return tabConfig.files.includes(activeTab);
  };

  // タブグループの代表ファイル名を取得（クリック時に使用）
  const getRepresentativeFile = (tabConfig: DataFileTab): string => {
    // 最初のファイルを使用
    return tabConfig.files[0] || 'data.json';
  };

  return (
    <div className="tab-bar">
      {dataFileTabs.map((tabConfig, index) => {
        const count = getTabItemCount(tabConfig);
        const representativeFile = getRepresentativeFile(tabConfig);
        // ツールチップにデータファイル名と物理ファイル名を表示
        const filesTitle = tabConfig.files
          .map((fileName) => {
            const label = getFileLabel(fileName);
            return label === fileName ? fileName : `${label} (${fileName})`;
          })
          .join(', ');

        return (
          <button
            key={`tab-${index}-${representativeFile}`}
            className={`tab-button ${isTabActive(tabConfig) ? 'active' : ''}`}
            onClick={() => onTabClick(representativeFile)}
            title={filesTitle}
          >
            {tabConfig.name}
            <span className="tab-count">({count})</span>
          </button>
        );
      })}
    </div>
  );
};

export default LauncherFileTabBar;
