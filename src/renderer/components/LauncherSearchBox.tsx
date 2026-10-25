import {
  forwardRef,
  useRef,
  useImperativeHandle,
  type ReactElement,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { SearchMode } from '@common/types/search';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  /** 検索欄の右クリック（文字のメニューと検索履歴を出す） */
  onContextMenu?: (e: MouseEvent<HTMLInputElement>) => void;
  searchMode?: SearchMode;
  onToggleSearchMode?: () => void;
}

const SEARCH_MODE_LABEL_KEYS = {
  normal: 'launcher.search.modeNormal',
  window: 'launcher.search.modeWindow',
} as const satisfies Record<SearchMode, string>;

// 切り替え先の名前で書く（今のモードは左のバッジで分かる）
const SEARCH_MODE_TOGGLE_KEYS = {
  normal: 'launcher.search.toWindowSearch',
  window: 'launcher.search.toNormalSearch',
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

/** 「キー:説明」の組（狭いときも組の途中で折り返さない） */
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
    { value, onChange, onKeyDown, onContextMenu, searchMode = 'normal', onToggleSearchMode },
    ref
  ) => {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => inputRef.current!);

    const handleClear = () => {
      onChange('');
      inputRef.current?.focus();
    };

    // 検索欄とモードの行を並べて返す。モードの行はヘッダーの 2 段目に回り、右のボタンの下まで使う（Header.css）
    return (
      <>
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
              onContextMenu={onContextMenu}
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
        </div>

        <div className="search-mode-indicator">
          <span className="search-mode-label">{t(SEARCH_MODE_LABEL_KEYS[searchMode])}</span>
          <KeyHint
            keyName="Shift+Tab"
            label={t(SEARCH_MODE_TOGGLE_KEYS[searchMode])}
            onClick={onToggleSearchMode}
          />
        </div>
      </>
    );
  }
);

LauncherSearchBox.displayName = 'LauncherSearchBox';

export default LauncherSearchBox;
