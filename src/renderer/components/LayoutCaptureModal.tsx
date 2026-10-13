import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { WindowInfo, VirtualDesktopInfo, LayoutWindowEntry } from '@common/types';

import '../styles/components/LayoutCaptureModal.css';
import { logError } from '../utils/debug';
import { getCountClass } from '../utils/tabUtils';

import { Button } from './ui';

interface LayoutCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (entries: LayoutWindowEntry[]) => void;
}

/**
 * レイアウトキャプチャモーダル
 * 実行中の全ウィンドウを表示し、チェックボックスで複数選択して取り込む
 */
const LayoutCaptureModal: React.FC<LayoutCaptureModalProps> = ({ isOpen, onClose, onCapture }) => {
  const { t } = useTranslation();
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [desktopInfo, setDesktopInfo] = useState<VirtualDesktopInfo | null>(null);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [selectedHwnds, setSelectedHwnds] = useState<Set<string>>(new Set());
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setSelectedHwnds(new Set());
      setFilterText('');
      try {
        const [info, allWindows] = await Promise.all([
          window.electronAPI.getVirtualDesktopInfo(),
          window.electronAPI.getAllWindowsAllDesktops(),
        ]);

        setDesktopInfo(info);
        setWindows(allWindows);

        if (info.supported && info.currentDesktop > 0) {
          setActiveTab(info.currentDesktop);
        } else {
          setActiveTab(0);
        }
      } catch (err) {
        logError('Failed to fetch windows:', err);
        setError(t('windowPicker.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    modalRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  const tabs = useMemo(() => {
    const tabList: { id: number; label: string; count: number }[] = [];
    tabList.push({ id: 0, label: t('windowPicker.all'), count: windows.length });

    if (desktopInfo?.supported && desktopInfo.desktopCount > 0) {
      for (let i = 1; i <= desktopInfo.desktopCount; i++) {
        const count = windows.filter((w) => w.desktopNumber === i).length;
        const isCurrent = i === desktopInfo.currentDesktop;
        tabList.push({
          id: i,
          label: isCurrent
            ? t('windowPicker.currentDesktop', { number: i })
            : t('windowPicker.desktop', { number: i }),
          count,
        });
      }
    }

    return tabList;
  }, [windows, desktopInfo, t]);

  const filteredWindows = useMemo(() => {
    let result = windows;

    if (activeTab !== 0) {
      result = result.filter((w) => w.desktopNumber === activeTab);
    }

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

  const toggleWindow = (hwnd: string) => {
    setSelectedHwnds((prev) => {
      const next = new Set(prev);
      if (next.has(hwnd)) {
        next.delete(hwnd);
      } else {
        next.add(hwnd);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedHwnds.size === filteredWindows.length) {
      setSelectedHwnds(new Set());
    } else {
      setSelectedHwnds(new Set(filteredWindows.map((w) => String(w.hwnd))));
    }
  };

  const handleCapture = () => {
    const entries: LayoutWindowEntry[] = windows
      .filter((w) => selectedHwnds.has(String(w.hwnd)))
      .map((w) => ({
        windowTitle: w.title,
        processName: w.processName,
        executablePath: w.executablePath,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
        virtualDesktopNumber: w.desktopNumber,
        launchApp: true,
        icon: w.icon,
      }));

    onCapture(entries);
    onClose();
  };

  if (!isOpen) return null;

  const showTabs = desktopInfo?.supported && desktopInfo.desktopCount > 1;

  return (
    <div className="layout-capture-modal-overlay" onClick={onClose}>
      <div
        className="layout-capture-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        tabIndex={-1}
      >
        <div className="layout-capture-header">
          <h3>{t('windowPicker.captureTitle')}</h3>
          <button className="close-btn close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="layout-capture-body">
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
              placeholder={t('windowPicker.filterPlaceholder')}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="filter-input"
            />
          </div>

          {loading && <p>{t('windowPicker.loading')}</p>}
          {error && <p>{error}</p>}

          {!loading && !error && (
            <>
              <div className="select-all-section">
                <label>
                  <input
                    type="checkbox"
                    checked={
                      filteredWindows.length > 0 && selectedHwnds.size === filteredWindows.length
                    }
                    onChange={toggleAll}
                  />
                  {t('windowPicker.selectAll')}
                </label>
              </div>

              <div className="layout-capture-window-list">
                {filteredWindows.length === 0 ? (
                  <p>{t('windowPicker.noWindows')}</p>
                ) : (
                  filteredWindows.map((win) => {
                    const hwndStr = String(win.hwnd);
                    const isSelected = selectedHwnds.has(hwndStr);
                    return (
                      <div
                        key={hwndStr}
                        className={`layout-capture-window-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleWindow(hwndStr)}
                      >
                        <input
                          type="checkbox"
                          className="window-checkbox"
                          checked={isSelected}
                          onChange={() => toggleWindow(hwndStr)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {win.icon && (
                          <div className="window-icon">
                            <img src={win.icon} alt="" />
                          </div>
                        )}
                        <div className="window-info">
                          <div className="window-title">{win.title}</div>
                          <div className="window-details">
                            <span>{t('windowPicker.position', { x: win.x, y: win.y })}</span>
                            <span>
                              {t('windowPicker.size', { width: win.width, height: win.height })}
                            </span>
                            {win.executablePath && (
                              <span title={win.executablePath}>
                                {win.executablePath.split('\\').pop()}
                              </span>
                            )}
                            {showTabs &&
                              activeTab === 0 &&
                              win.desktopNumber &&
                              win.desktopNumber > 0 && (
                                <span>
                                  {t('windowPicker.desktop', { number: win.desktopNumber })}
                                </span>
                              )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div className="layout-capture-footer">
          <span className="selection-count">
            {t('windowPicker.selected', { count: selectedHwnds.size })}
          </span>
          <div className="footer-actions">
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCapture} disabled={selectedHwnds.size === 0}>
              {t('windowPicker.add')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayoutCaptureModal;
