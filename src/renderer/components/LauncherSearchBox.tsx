import {
  forwardRef,
  useRef,
  useImperativeHandle,
  type ReactElement,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { SearchMode } from '@common/types/search';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  searchMode?: SearchMode;
  onToggleSearchMode?: () => void;
  onRefreshWindows?: () => void;
  onReloadData?: () => void;
}

const SEARCH_MODE_LABEL_KEYS = {
  normal: 'launcher.search.modeNormal',
  window: 'launcher.search.modeWindow',
} as const satisfies Record<SearchMode, string>;

function F5Hint({ label, onClick }: { label: string; onClick: () => void }): ReactElement {
  return (
    <>
      F5:
      <button type="button" className="search-mode-hint-link" onClick={onClick}>
        {label}
      </button>
      {'　'}
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
    const { t } = useTranslation();
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
            placeholder={t('launcher.search.placeholder')}
            autoFocus
          />
          {value && (
            <button
              className="close-btn close-btn-sm search-clear-button"
              onClick={handleClear}
              type="button"
              aria-label={t('launcher.search.clear')}
            >
              ×
            </button>
          )}
        </div>

        <div className="search-mode-indicator">
          <span className="search-mode-label">{t(SEARCH_MODE_LABEL_KEYS[searchMode])}</span>
          <span>
            {searchMode === 'window' && onRefreshWindows && (
              <F5Hint label={t('launcher.search.refreshWindows')} onClick={onRefreshWindows} />
            )}
            {searchMode === 'normal' && onReloadData && (
              <F5Hint label={t('launcher.search.reloadData')} onClick={onReloadData} />
            )}
            Shift+Tab:
            <button type="button" className="search-mode-hint-link" onClick={onToggleSearchMode}>
              {t('launcher.search.toggleMode')}
            </button>
          </span>
        </div>
      </div>
    );
  }
);

LauncherSearchBox.displayName = 'LauncherSearchBox';

export default LauncherSearchBox;
