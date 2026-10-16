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

const SEARCH_MODE_PLACEHOLDER_KEYS = {
  normal: 'launcher.search.placeholder',
  window: 'launcher.search.placeholderWindow',
} as const satisfies Record<SearchMode, string>;

// 検索欄の左端に出すモードの目印（両モードで同じ幅にして、入力の書き出し位置をそろえる）
const SEARCH_MODE_ICONS = {
  normal: '🔍',
  window: '🪟',
} as const satisfies Record<SearchMode, string>;

/** 「キー:説明」の組（狭いときは組の途中で折り返さず、組ごとに次の行へ回す） */
function KeyHint({
  keyName,
  label,
  onClick,
}: {
  keyName: string;
  label: string;
  onClick?: () => void;
}): ReactElement {
  return (
    <span className="search-mode-hint">
      {keyName}:
      <button type="button" className="search-mode-hint-link" onClick={onClick}>
        {label}
      </button>
    </span>
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
          <span className="search-mode-icon" aria-hidden="true" data-testid="search-mode-icon">
            {SEARCH_MODE_ICONS[searchMode]}
          </span>
          <input
            ref={inputRef}
            type="text"
            className="search-box"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t(SEARCH_MODE_PLACEHOLDER_KEYS[searchMode])}
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
          <span className="search-mode-hints">
            {searchMode === 'window' && onRefreshWindows && (
              <KeyHint
                keyName="F5"
                label={t('launcher.search.refreshWindows')}
                onClick={onRefreshWindows}
              />
            )}
            {searchMode === 'normal' && onReloadData && (
              <KeyHint
                keyName="F5"
                label={t('launcher.search.reloadData')}
                onClick={onReloadData}
              />
            )}
            <KeyHint
              keyName="Shift+Tab"
              label={t('launcher.search.toggleMode')}
              onClick={onToggleSearchMode}
            />
          </span>
        </div>
      </div>
    );
  }
);

LauncherSearchBox.displayName = 'LauncherSearchBox';

export default LauncherSearchBox;
