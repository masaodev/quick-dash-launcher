import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import { SearchMode } from '@common/types/search';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  searchMode?: SearchMode;
  onToggleSearchMode?: () => void;
  onRefreshWindows?: () => void;
  onReloadData?: () => void;
}

const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
  normal: '通常検索モード',
  window: '🪟 ウィンドウ検索モード',
  history: '📜 実行履歴検索モード',
};

interface F5HintProps {
  label: string;
  onClick: () => void;
}

function F5Hint({ label, onClick }: F5HintProps): React.ReactElement {
  return (
    <>
      F5:
      <button type="button" className="search-mode-hint-link" onClick={onClick}>
        {label}
      </button>
      {' / '}
    </>
  );
}

const LauncherSearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  (
    {
      value,
      onChange,
      onKeyDown,
      searchMode = 'normal',
      onToggleSearchMode,
      onRefreshWindows,
      onReloadData,
    },
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
              <F5Hint label="更新" onClick={onRefreshWindows} />
            )}
            {searchMode === 'normal' && onReloadData && (
              <F5Hint label="データ再読込" onClick={onReloadData} />
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
