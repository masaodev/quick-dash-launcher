import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { GROUP_COLOR_TOKENS, resolveGroupColorCss } from '@common/groupColors';

interface ColorPickerProps {
  /** 色選択時のコールバック（色トークンを渡す） */
  onSelectColor: (colorToken: string) => void;
  /** 閉じる際のコールバック */
  onClose: () => void;
  /** 現在選択されている色（トークン） */
  currentColor?: string;
  /** モーダルモードの場合はtrueにして内部のイベントリスナーを無効化 */
  disableEventListeners?: boolean;
}

/**
 * グループ色選択用のカラーピッカーコンポーネント
 * プリセット色をグリッド表示し、クリック時に色を選択
 */
const ColorPicker: React.FC<ColorPickerProps> = ({
  onSelectColor,
  onClose,
  currentColor,
  disableEventListeners = false,
}) => {
  const { t } = useTranslation();
  const pickerRef = useRef<HTMLDivElement>(null);

  // ESCキーで閉じる（モーダルモードでは無効化）
  useEffect(() => {
    if (disableEventListeners) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, disableEventListeners]);

  // 外側クリックで閉じる（モーダルモードでは無効化）
  useEffect(() => {
    if (disableEventListeners) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // 少し遅延させてから外側クリック検出を有効にする
    // （ボタンクリックで開いた直後に閉じるのを防ぐ）
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, disableEventListeners]);

  return (
    <div className="color-picker-dropdown" ref={pickerRef}>
      <div className="color-picker-grid">
        {GROUP_COLOR_TOKENS.map((token) => (
          <button
            key={token}
            className={`color-picker-option ${currentColor === token ? 'selected' : ''}`}
            style={{ backgroundColor: resolveGroupColorCss(token) }}
            onClick={() => onSelectColor(token)}
            title={t(`groupColors.${token}`)}
            type="button"
          />
        ))}
      </div>
    </div>
  );
};

export default ColorPicker;
