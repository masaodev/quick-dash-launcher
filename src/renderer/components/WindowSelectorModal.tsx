import React, { useState, useEffect } from 'react';
import type { WindowInfo } from '@common/types';

import '../styles/components/WindowSelectorModal.css';

interface WindowSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (window: WindowInfo) => void;
}

/**
 * 実行中ウィンドウ選択ダイアログ
 * 実行中のウィンドウ一覧を表示し、選択したウィンドウの情報を返す
 */
const WindowSelectorModal: React.FC<WindowSelectorModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [windows, setWindows] = useState<WindowInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');

  // ウィンドウ一覧を取得
  useEffect(() => {
    if (!isOpen) return;

    const fetchWindows = async () => {
      setLoading(true);
      setError(null);
      try {
        const allWindows = await window.electronAPI.getAllWindows();
        setWindows(allWindows);
      } catch (err) {
        console.error('Failed to fetch windows:', err);
        setError('ウィンドウ一覧の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchWindows();
  }, [isOpen]);

  // フィルタリングされたウィンドウ一覧
  const filteredWindows = windows.filter((win) => {
    if (!filterText) return true;
    const lowerFilter = filterText.toLowerCase();
    return (
      win.title.toLowerCase().includes(lowerFilter) ||
      (win.executablePath && win.executablePath.toLowerCase().includes(lowerFilter))
    );
  });

  const handleSelect = (window: WindowInfo) => {
    onSelect(window);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="window-selector-modal-overlay" onClick={onClose}>
      <div className="window-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="window-selector-header">
          <h3>ウィンドウを選択</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="window-selector-body">
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
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="window-selector-footer">
          <button onClick={onClose} className="cancel-button">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};

export default WindowSelectorModal;
