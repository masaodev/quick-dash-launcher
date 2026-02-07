import React, { useMemo } from 'react';
import { DESKTOP_TAB } from '@common/constants';
import type { WindowInfo, VirtualDesktopInfo } from '@common/types';

import { getCountClass } from '../utils/tabUtils';
import { filterItems } from '../utils/dataParser';

interface DesktopTabBarProps {
  /** 仮想デスクトップ情報 */
  desktopInfo: VirtualDesktopInfo;
  /** 現在アクティブなデスクトップタブ（0=すべて、1以降=デスクトップ番号、-1=不明） */
  activeDesktopTab: number;
  /** ウィンドウリスト */
  windowList: WindowInfo[];
  /** 検索クエリ（フィルタリング用） */
  searchQuery: string;
  /** タブ変更時のハンドラ */
  onTabChange: (tabId: number) => void;
}

interface DesktopTab {
  id: number;
  label: string;
  count: number;
}

function getTabTooltip(tabId: number, desktopNames?: Record<number, string | undefined>): string {
  if (tabId === DESKTOP_TAB.ALL) {
    return 'すべてのデスクトップのウィンドウ';
  }
  if (tabId === DESKTOP_TAB.PINNED) {
    return '全仮想デスクトップにピン止めされたウィンドウ';
  }
  const name = desktopNames?.[tabId];
  if (name) {
    return `デスクトップ ${tabId}「${name}」のウィンドウ`;
  }
  return `デスクトップ ${tabId} のウィンドウ`;
}

/**
 * ウィンドウ検索モード用デスクトップタブバーコンポーネント
 * 仮想デスクトップごとにウィンドウをタブで切り替え可能にする
 */
const LauncherDesktopTabBar: React.FC<DesktopTabBarProps> = ({
  desktopInfo,
  activeDesktopTab,
  windowList,
  searchQuery,
  onTabChange,
}) => {
  // タブリストを生成（useMemoで最適化）
  const tabs = useMemo((): DesktopTab[] => {
    // 検索クエリでフィルタリング
    const filteredWindows = filterItems(windowList, searchQuery, 'window') as WindowInfo[];

    const tabList: DesktopTab[] = [
      { id: DESKTOP_TAB.ALL, label: 'すべて', count: filteredWindows.length },
    ];

    // 「ピン止め」タブ（ピン止めされたウィンドウがある場合のみ表示）
    const pinnedCount = filteredWindows.filter((w) => w.isPinned === true).length;
    if (pinnedCount > 0) {
      tabList.push({ id: DESKTOP_TAB.PINNED, label: 'ピン止め', count: pinnedCount });
    }

    // 各デスクトップのタブを追加
    for (let i = 1; i <= desktopInfo.desktopCount; i++) {
      const count = filteredWindows.filter((w) => w.desktopNumber === i).length;
      const isCurrent = i === desktopInfo.currentDesktop;
      const desktopName = desktopInfo.desktopNames?.[i];
      const baseLabel = desktopName || `${i}`;
      tabList.push({
        id: i,
        label: isCurrent ? `${baseLabel} (現在)` : baseLabel,
        count,
      });
    }

    return tabList;
  }, [
    windowList,
    searchQuery,
    desktopInfo.desktopCount,
    desktopInfo.currentDesktop,
    desktopInfo.desktopNames,
  ]);

  return (
    <div className="tab-bar">
      {tabs.map((tab) => {
        const countClass = getCountClass(tab.count);
        return (
          <button
            key={tab.id}
            className={`tab-button ${countClass} ${activeDesktopTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            title={getTabTooltip(tab.id, desktopInfo.desktopNames)}
          >
            {tab.label}
            <span className={`tab-count ${countClass}`}>({tab.count})</span>
          </button>
        );
      })}
    </div>
  );
};

export default LauncherDesktopTabBar;
