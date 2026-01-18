import React, { useMemo } from 'react';
import type { WindowInfo, VirtualDesktopInfo } from '@common/types';

interface DesktopTabBarProps {
  /** 仮想デスクトップ情報 */
  desktopInfo: VirtualDesktopInfo;
  /** 現在アクティブなデスクトップタブ（0=すべて、1以降=デスクトップ番号、-1=不明） */
  activeDesktopTab: number;
  /** ウィンドウリスト */
  windowList: WindowInfo[];
  /** タブ変更時のハンドラ */
  onTabChange: (tabId: number) => void;
}

interface DesktopTab {
  id: number;
  label: string;
  count: number;
}

function getTabTooltip(tabId: number): string {
  if (tabId === 0) {
    return 'すべてのデスクトップのウィンドウ';
  }
  if (tabId === -1) {
    return 'デスクトップ番号が不明なウィンドウ';
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
  onTabChange,
}) => {
  // タブリストを生成（useMemoで最適化）
  const tabs = useMemo((): DesktopTab[] => {
    const tabList: DesktopTab[] = [];

    // 「すべて」タブ
    tabList.push({ id: 0, label: 'すべて', count: windowList.length });

    // 各デスクトップのタブを追加
    for (let i = 1; i <= desktopInfo.desktopCount; i++) {
      const count = windowList.filter((w) => w.desktopNumber === i).length;
      const isCurrent = i === desktopInfo.currentDesktop;
      tabList.push({
        id: i,
        label: isCurrent ? `${i} (現在)` : `${i}`,
        count,
      });
    }

    // デスクトップ番号が不明なウィンドウがある場合
    const unknownCount = windowList.filter(
      (w) => w.desktopNumber === undefined || w.desktopNumber === -1
    ).length;
    if (unknownCount > 0) {
      tabList.push({ id: -1, label: '?', count: unknownCount });
    }

    return tabList;
  }, [windowList, desktopInfo.desktopCount, desktopInfo.currentDesktop]);

  return (
    <div className="desktop-tabs-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`desktop-tab-button ${activeDesktopTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          title={getTabTooltip(tab.id)}
        >
          {tab.label}
          <span className="tab-count">({tab.count})</span>
        </button>
      ))}
    </div>
  );
};

export default LauncherDesktopTabBar;
