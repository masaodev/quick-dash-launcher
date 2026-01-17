import React, { forwardRef, useRef, useImperativeHandle, useMemo } from 'react';
import { SearchMode } from '@common/types/search';
import type { WindowInfo, VirtualDesktopInfo } from '@common/types';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  searchMode?: SearchMode;
  // 仮想デスクトップタブ関連
  desktopInfo?: VirtualDesktopInfo | null;
  activeDesktopTab?: number;
  onDesktopTabChange?: (tab: number) => void;
  windowList?: WindowInfo[];
}

const LauncherSearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  (
    {
      value,
      onChange,
      onKeyDown,
      searchMode = 'normal',
      desktopInfo,
      activeDesktopTab = 0,
      onDesktopTabChange,
      windowList = [],
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => inputRef.current!);

    const handleClear = () => {
      onChange('');
      inputRef.current?.focus();
    };

    // タブリストを生成
    const tabs = useMemo(() => {
      if (searchMode !== 'window' || !desktopInfo?.supported || desktopInfo.desktopCount <= 1) {
        return [];
      }

      const tabList: { id: number; label: string; count: number }[] = [];

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
    }, [searchMode, desktopInfo, windowList]);

    // 仮想デスクトップタブを表示するかどうか
    const showDesktopTabs = tabs.length > 0;

    return (
      <div className="search-box-wrapper">
        <div className="search-box-container">
          <input
            ref={inputRef}
            type="text"
            className="search-box"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="検索..."
            autoFocus
          />
          {value && (
            <button
              className="search-clear-button"
              onClick={handleClear}
              type="button"
              aria-label="検索をクリア"
            >
              ×
            </button>
          )}
        </div>

        {/* 仮想デスクトップタブ（ウィンドウ検索モード時のみ表示） */}
        {showDesktopTabs && (
          <div className="desktop-tabs-bar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`desktop-tab-button ${activeDesktopTab === tab.id ? 'active' : ''}`}
                onClick={() => onDesktopTabChange?.(tab.id)}
              >
                {tab.label}
                <span className="tab-count">({tab.count})</span>
              </button>
            ))}
          </div>
        )}

        <div className="search-mode-indicator">
          {searchMode === 'window'
            ? 'ウィンドウ検索モード'
            : searchMode === 'history'
              ? '実行履歴検索モード'
              : '通常モード'}{' '}
          (Shift+Tabで切り替え)
        </div>
      </div>
    );
  }
);

LauncherSearchBox.displayName = 'LauncherSearchBox';

export default LauncherSearchBox;
