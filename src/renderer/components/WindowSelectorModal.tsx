import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { WindowInfo, VirtualDesktopInfo } from '@common/types';

import '../styles/components/WindowSelectorModal.css';
import { logError } from '../utils/debug';
import { getCountClass } from '../utils/tabUtils';

import { Button } from './ui';

interface WindowSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (window: WindowInfo) => void;
}

/**
 * 実行中ウィンドウ選択ダイアログ
 * 実行中のウィンドウ一覧を表示し、選択したウィンドウの情報を返す
 * 仮想デスクトップごとにタブで分類表示
 */
const WindowSelectorModal: React.FC<WindowSelectorModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [desktopInfo, setDesktopInfo] = useState<VirtualDesktopInfo | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0); // 0 = すべて、1以降 = デスクトップ番号
  const modalRef = useRef<HTMLDivElement>(null);

  // ウィンドウ一覧と仮想デスクトップ情報を取得
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 仮想デスクトップ情報と全デスクトップのウィンドウを並行取得
        const [info, allWindows] = await Promise.all([
          window.electronAPI.getVirtualDesktopInfo(),
          window.electronAPI.getAllWindowsAllDesktops(),
        ]);

        setDesktopInfo(info);
        setWindows(allWindows);

        // 現在のデスクトップをデフォルトタブとして設定
        if (info.supported && info.currentDesktop > 0) {
          setActiveTab(info.currentDesktop);
        } else {
          setActiveTab(0);
        }
      } catch (err) {
        logError('Failed to fetch windows:', err);
        setError('ウィンドウ一覧の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen]);

  // キーイベント処理
  useEffect(() => {
    if (!isOpen) return;

    modalRef.current?.focus();

    const stopEvent = (event: KeyboardEvent, preventDefault = true): void => {
      if (preventDefault) event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const modal = modalRef.current;
      if (!modal) return;

      if (event.key === 'Escape') {
        stopEvent(event);
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey && document.activeElement === firstElement) {
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          firstElement.focus();
        }
        stopEvent(event);
        return;
      }

      if (!modal.contains(document.activeElement)) return;

      const activeElement = document.activeElement as HTMLElement;
      const isInputField =
        activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';

      if (isInputField) {
        const editingKeys = [
          'Backspace',
          'Delete',
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Home',
          'End',
        ];
        const isEditKey =
          event.key.length === 1 ||
          editingKeys.includes(event.key) ||
          (event.ctrlKey && ['a', 'c', 'v', 'x', 'z', 'y'].includes(event.key));

        if (isEditKey) {
          stopEvent(event, false);
          return;
        }
      }

      stopEvent(event);
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  // タブリストを生成
  const tabs = useMemo(() => {
    const tabList: { id: number; label: string; count: number }[] = [];

    // 「すべて」タブ
    tabList.push({ id: 0, label: 'すべて', count: windows.length });

    // 仮想デスクトップが有効な場合、各デスクトップのタブを追加
    if (desktopInfo?.supported && desktopInfo.desktopCount > 0) {
      for (let i = 1; i <= desktopInfo.desktopCount; i++) {
        const count = windows.filter((w) => w.desktopNumber === i).length;
        const isCurrent = i === desktopInfo.currentDesktop;
        tabList.push({
          id: i,
          label: isCurrent ? `デスクトップ ${i} (現在)` : `デスクトップ ${i}`,
          count,
        });
      }

      // デスクトップ番号が不明なウィンドウがある場合
      const unknownCount = windows.filter(
        (w) => w.desktopNumber === undefined || w.desktopNumber === -1
      ).length;
      if (unknownCount > 0) {
        tabList.push({ id: -1, label: '不明', count: unknownCount });
      }
    }

    return tabList;
  }, [windows, desktopInfo]);

  // フィルタリングされたウィンドウ一覧（タブとテキストフィルタ適用）
  const filteredWindows = useMemo(() => {
    let result = windows;

    // タブによるフィルタリング
    if (activeTab !== 0) {
      if (activeTab === -1) {
        // 不明タブ
        result = result.filter((w) => w.desktopNumber === undefined || w.desktopNumber === -1);
      } else {
        // 特定のデスクトップ
        result = result.filter((w) => w.desktopNumber === activeTab);
      }
    }

    // テキストフィルタリング
    if (filterText) {
      const lowerFilter = filterText.toLowerCase();
      result = result.filter(
        (win) =>
          win.title.toLowerCase().includes(lowerFilter) ||
          (win.executablePath && win.executablePath.toLowerCase().includes(lowerFilter))
      );
    }

    return result;
  }, [windows, activeTab, filterText]);

  const handleSelect = (window: WindowInfo) => {
    onSelect(window);
    onClose();
  };

  if (!isOpen) return null;

  // 仮想デスクトップタブを表示するかどうか
  const showTabs = desktopInfo?.supported && desktopInfo.desktopCount > 1;

  return (
    <div className="window-selector-modal-overlay" onClick={onClose}>
      <div
        className="window-selector-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="window-selector-header">
          <h3>ウィンドウを選択</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="window-selector-body">
          {/* 仮想デスクトップタブ */}
          {showTabs && (
            <div className="desktop-tabs">
              {tabs.map((tab) => {
                const countClass = getCountClass(tab.count);
                return (
                  <button
                    key={tab.id}
                    className={`desktop-tab ${countClass} ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                    <span className={`tab-count ${countClass}`}>({tab.count})</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="filter-section">
            <input
              type="text"
              placeholder="タイトルまたはプロセス名で絞り込み..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="filter-input"
            />
          </div>

          {loading && (
            <div className="loading-message">
              <p>ウィンドウ一覧を取得中...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="window-list">
              {filteredWindows.length === 0 ? (
                <div className="no-windows-message">
                  <p>表示可能なウィンドウが見つかりませんでした</p>
                </div>
              ) : (
                filteredWindows.map((win) => (
                  <div
                    key={String(win.hwnd)}
                    className="window-item"
                    onClick={() => handleSelect(win)}
                  >
                    {win.icon && (
                      <div className="window-icon">
                        <img src={win.icon} alt="" />
                      </div>
                    )}
                    <div className="window-info">
                      <div className="window-title">{win.title}</div>
                      <div className="window-details">
                        <span className="window-position">
                          位置: ({win.x}, {win.y})
                        </span>
                        <span className="window-size">
                          サイズ: {win.width} × {win.height}
                        </span>
                        {win.executablePath && (
                          <span className="window-process" title={win.executablePath}>
                            {win.executablePath.split('\\').pop()}
                          </span>
                        )}
                        {showTabs &&
                          activeTab === 0 &&
                          win.desktopNumber &&
                          win.desktopNumber > 0 && (
                            <span className="window-desktop">
                              デスクトップ {win.desktopNumber}
                              {win.desktopNumber === desktopInfo?.currentDesktop && ' (現在)'}
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="window-selector-footer">
          <Button variant="cancel" onClick={onClose}>
            キャンセル
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WindowSelectorModal;
