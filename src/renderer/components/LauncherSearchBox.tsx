import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import { SearchMode } from '@common/types/search';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  searchMode?: SearchMode;
}

const LauncherSearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  ({ value, onChange, onKeyDown, searchMode = 'normal' }, ref) => {
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
