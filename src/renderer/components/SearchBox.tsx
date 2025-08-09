import React, { forwardRef, useRef, useImperativeHandle } from 'react';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  ({ value, onChange, onKeyDown }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => inputRef.current!);

    const handleClear = () => {
      onChange('');
      inputRef.current?.focus();
    };

    return (
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
    );
  }
);

SearchBox.displayName = 'SearchBox';

export default SearchBox;
