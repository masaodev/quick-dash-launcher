import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import { SearchMode } from '@common/types/search';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  searchMode?: SearchMode;
  onToggleSearchMode?: () => void;
  onRefreshWindows?: () => void;
}

const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
  normal: '通常検索モード',
  window: '🪟 ウィンドウ検索モード',
  history: '📜 実行履歴検索モード',
};

const LauncherSearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  (
    { value, onChange, onKeyDown, searchMode = 'normal', onToggleSearchMode, onRefreshWindows },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => inputRef.current!);

    const handleClear = () => {
      onChange('');
      inputRef.current?.focus();
    };

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

        <div className="search-mode-indicator">
          <span className="search-mode-label">{SEARCH_MODE_LABELS[searchMode]}</span>
          <span>
            {searchMode === 'window' && onRefreshWindows && (
              <>
                F5:
                <button type="button" className="search-mode-hint-link" onClick={onRefreshWindows}>
                  更新
                </button>
                {' / '}
              </>
            )}
            Shift+Tab:
            <button type="button" className="search-mode-hint-link" onClick={onToggleSearchMode}>
              モード切り替え
            </button>
          </span>
        </div>
      </div>
    );
  }
);

LauncherSearchBox.displayName = 'LauncherSearchBox';

export default LauncherSearchBox;
