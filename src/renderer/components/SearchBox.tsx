import React, { forwardRef } from 'react';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  ({ value, onChange, onKeyDown }, ref) => {
    return (
      <input
        ref={ref}
        type="text"
        className="search-box"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="検索..."
        autoFocus
      />
    );
  }
);

SearchBox.displayName = 'SearchBox';

export default SearchBox;