import React, { useEffect, useRef } from 'react';

import { GROUP_COLOR_PALETTE } from '../constants';

interface ColorPickerProps {
  /** 色選択時のコールバック */
  onSelectColor: (colorValue: string) => void;
  /** 閉じる際のコールバック */
  onClose: () => void;
  /** 現在選択されている色 */
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
        {GROUP_COLOR_PALETTE.map((color) => (
          <button
            key={color.value}
            className={`color-picker-option ${currentColor === color.value ? 'selected' : ''}`}
            style={{ backgroundColor: color.value }}
            onClick={() => onSelectColor(color.value)}
            title={color.name}
            type="button"
          />
        ))}
      </div>
    </div>
  );
};

export default ColorPicker;
