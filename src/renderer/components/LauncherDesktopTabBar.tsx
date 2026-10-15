import React, { useMemo } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { DESKTOP_TAB } from '@common/constants';
import { desktopLabel } from '@common/utils/desktopLabel';
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

function getTabTooltip(
  t: TFunction,
  tabId: number,
  desktopNames?: Record<number, string | undefined>
): string {
  if (tabId === DESKTOP_TAB.ALL) {
    return t('launcher.desktopTabs.allTooltip');
  }
  if (tabId === DESKTOP_TAB.PINNED) {
    return t('launcher.desktopTabs.onAllDesktopsTooltip');
  }
  const name = desktopNames?.[tabId];
  if (name) {
    return t('launcher.desktopTabs.namedDesktopTooltip', { number: tabId, name });
  }
  return t('launcher.desktopTabs.desktopTooltip', { number: tabId });
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
  const { t } = useTranslation();
  // タブリストを生成（useMemoで最適化）
  const tabs = useMemo((): DesktopTab[] => {
    // 検索クエリでフィルタリング
    const filteredWindows = filterItems(windowList, searchQuery, 'window') as WindowInfo[];

    const tabList: DesktopTab[] = [
      { id: DESKTOP_TAB.ALL, label: t('launcher.desktopTabs.all'), count: filteredWindows.length },
    ];

    // 「全デスクトップ」タブ（すべてのデスクトップに表示するウィンドウがある場合のみ表示）
    const pinnedCount = filteredWindows.filter((w) => w.isPinned === true).length;
    if (pinnedCount > 0) {
      tabList.push({
        id: DESKTOP_TAB.PINNED,
        label: t('launcher.desktopTabs.onAllDesktops'),
        count: pinnedCount,
      });
    }

    // 各デスクトップのタブを追加
    for (let i = 1; i <= desktopInfo.desktopCount; i++) {
      const count = filteredWindows.filter((w) => w.desktopNumber === i).length;
      const isCurrent = i === desktopInfo.currentDesktop;
      const baseLabel = desktopLabel(i, desktopInfo.desktopNames);
      tabList.push({
        id: i,
        label: isCurrent ? t('launcher.desktopTabs.current', { name: baseLabel }) : baseLabel,
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
    t,
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
            title={getTabTooltip(t, tab.id, desktopInfo.desktopNames)}
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
