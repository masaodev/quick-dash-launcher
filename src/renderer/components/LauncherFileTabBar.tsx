import React, { useState, useRef, useEffect } from 'react';
import { DEFAULT_DATA_FILE, AppItem, DataFileTab } from '@common/types';
import { isWindowInfo } from '@common/types/guards';

import { filterItems } from '../utils/dataParser';
import { getCountClass } from '../utils/tabUtils';

interface FileTabBarProps {
  /** データファイルタブの設定（タブグループのリスト） */
  dataFileTabs: DataFileTab[];
  /** 現在アクティブなタブ（ファイル名） */
  activeTab: string;
  /** タブクリック時のハンドラ（タブグループの最初のファイル名を渡す） */
  onTabClick: (fileName: string) => void;
  /** タブ名変更時のハンドラ */
  onTabRename: (tabIndex: number, newName: string) => void;
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
  onTabRename,
  allItems,
  searchQuery,
  dataFileLabels = {},
}) => {
  const [editingTabIndex, setEditingTabIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // コンテキストメニューからのリネームイベントを受信
  useEffect(() => {
    const cleanup = window.electronAPI.onFileTabMenuRename((tabIndex: number) => {
      if (tabIndex >= 0 && tabIndex < dataFileTabs.length) {
        setEditName(dataFileTabs[tabIndex].name);
        setEditingTabIndex(tabIndex);
      }
    });
    return cleanup;
  }, [dataFileTabs]);

  // 編集モード時にinputにフォーカス
  useEffect(() => {
    if (editingTabIndex !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabIndex]);

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
    return tabConfig.files[0] || DEFAULT_DATA_FILE;
  };

  const handleContextMenu = (e: React.MouseEvent, index: number): void => {
    e.preventDefault();
    window.electronAPI.showFileTabContextMenu(index);
  };

  const handleSaveEdit = (): void => {
    if (editingTabIndex !== null && editName.trim()) {
      const currentName = dataFileTabs[editingTabIndex].name;
      if (editName.trim() !== currentName) {
        onTabRename(editingTabIndex, editName.trim());
      }
    }
    setEditingTabIndex(null);
  };

  const handleCancelEdit = (): void => {
    setEditingTabIndex(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent): void => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  return (
    <div className="tab-bar">
      {dataFileTabs.map((tabConfig, index) => {
        const count = getTabItemCount(tabConfig);
        const countClass = getCountClass(count);
        const representativeFile = getRepresentativeFile(tabConfig);
        // ツールチップにデータファイル名と物理ファイル名を表示
        const filesTitle = tabConfig.files
          .map((fileName) => {
            const label = dataFileLabels[fileName] || fileName;
            return label === fileName ? fileName : `${label} (${fileName})`;
          })
          .join(', ');

        return (
          <button
            key={`tab-${index}-${representativeFile}`}
            className={`tab-button ${countClass} ${isTabActive(tabConfig) ? 'active' : ''}`}
            onClick={() => onTabClick(representativeFile)}
            onContextMenu={(e) => handleContextMenu(e, index)}
            title={filesTitle}
          >
            {editingTabIndex === index ? (
              <input
                ref={inputRef}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleEditKeyDown}
                onBlur={handleSaveEdit}
                onClick={(e) => e.stopPropagation()}
                className="tab-name-input"
              />
            ) : (
              tabConfig.name
            )}
            <span className={`tab-count ${countClass}`}>({count})</span>
          </button>
        );
      })}
    </div>
  );
};

export default LauncherFileTabBar;
