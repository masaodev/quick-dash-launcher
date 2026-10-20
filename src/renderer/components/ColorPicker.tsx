import React from 'react';
import { useTranslation } from 'react-i18next';
import { GROUP_COLOR_TOKENS, resolveGroupColorCss } from '@common/groupColors';

interface ColorPickerProps {
  /** 色選択時のコールバック（色トークンを渡す） */
  onSelectColor: (colorToken: string) => void;
  /** 現在選択されている色（トークン） */
  currentColor?: string;
}

/**
 * グループ色選択用のカラーピッカーコンポーネント
 * プリセット色をグリッド表示し、クリック時に色を選択
 *
 * Esc・外側クリックで閉じる処理は持たない（呼び出し側のモーダルで扱う）
 */
const ColorPicker: React.FC<ColorPickerProps> = ({ onSelectColor, currentColor }) => {
  const { t } = useTranslation();

  return (
    <div className="color-picker-dropdown">
      <div className="color-picker-grid">
        {GROUP_COLOR_TOKENS.map((token) => (
          <button
            key={token}
            className={`color-picker-option ${currentColor === token ? 'selected' : ''}`}
            style={{ backgroundColor: resolveGroupColorCss(token) }}
            onClick={() => onSelectColor(token)}
            title={t(`groupColors.${token}`)}
            aria-label={t(`groupColors.${token}`)}
            aria-pressed={currentColor === token}
            type="button"
          >
            {/* 今の色。青い色に青い枠だけでは見えないので、白い ✓ を重ねる */}
            {currentColor === token && <span className="color-picker-check">✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ColorPicker;
