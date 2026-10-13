/**
 * 画面: ホットキー入力
 * 画面仕様: docs/screens/hotkey-input.md
 */
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/components/HotkeyInput.css';

import { Button } from './ui/Button';

interface HotkeyInputProps {
  value: string;
  onChange: (hotkey: string) => void;
  onValidationChange: (isValid: boolean, reason?: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** 空文字列を許可するかどうか（デフォルト: false） */
  allowEmpty?: boolean;
  /** クリアボタンを表示するかどうか（デフォルト: false） */
  showClearButton?: boolean;
}

export const HotkeyInput: React.FC<HotkeyInputProps> = ({
  value,
  onChange,
  onValidationChange,
  disabled = false,
  placeholder: placeholderProp,
  allowEmpty = false,
  showClearButton = false,
}) => {
  const { t } = useTranslation();
  const placeholder = placeholderProp ?? t('hotkeyInput.placeholder');
  const [isRecording, setIsRecording] = useState(false);
  const [currentKeys, setCurrentKeys] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // キーの正規化
  const normalizeKey = (key: string): string => {
    const keyMap: { [key: string]: string } = {
      Control: 'Ctrl',
      Meta: 'CmdOrCtrl',
      ' ': 'Space',
    };
    return keyMap[key] || key;
  };

  const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'CmdOrCtrl'];
  const SPECIAL_KEYS = ['Space', 'Enter', 'Tab', 'Escape', 'Delete', 'Backspace'];

  const addKey = (key: string) => {
    setCurrentKeys((prev) => new Set([...prev, key]));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isRecording) return;

    event.preventDefault();
    event.stopPropagation();

    const key = normalizeKey(event.key);

    if (MODIFIERS.includes(key)) {
      addKey(key);
    } else if (key.length === 1 && /[A-Za-z0-9]/.test(key)) {
      addKey(key.toUpperCase());
    } else if (/^F(?:[1-9]|1[0-2])$/.test(key)) {
      addKey(key);
    } else if (SPECIAL_KEYS.includes(key)) {
      addKey(key);
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isRecording) return;

    event.preventDefault();
    event.stopPropagation();

    // Alt+Space の Space は、押したとき（keydown）を Windows が受け取ってしまい離したとき（keyup）しか
    // 届かないので、ここで拾う
    let keys = currentKeys;
    if (normalizeKey(event.key) === 'Space' && keys.has('Alt') && !keys.has('Space')) {
      keys = new Set([...keys, 'Space']);
    }

    // キーが2つ以上組み合わされている場合、ホットキーとして確定
    if (keys.size >= 2) {
      const keysArray = Array.from(keys);
      const modifiers = keysArray.filter((k) => MODIFIERS.includes(k));
      const nonModifiers = keysArray.filter((k) => !MODIFIERS.includes(k));

      if (modifiers.length > 0 && nonModifiers.length > 0) {
        const hotkey = [...modifiers, ...nonModifiers].join('+');
        onChange(hotkey);
        setIsRecording(false);
        setCurrentKeys(new Set());
        inputRef.current?.blur();
      }
    }
  };

  // 録画中は本体に伝え、QDL 自身のホットキーと Windows のウィンドウメニュー（Alt+Space）を止めてもらう。
  // 録画の終了・画面を閉じたときに戻す
  useEffect(() => {
    if (!isRecording) return;
    void window.electronAPI.setHotkeyRecording(true);
    return () => {
      void window.electronAPI.setHotkeyRecording(false);
    };
  }, [isRecording]);

  // バリデーション
  useEffect(() => {
    if (value) {
      validateHotkey(value);
    } else if (allowEmpty) {
      // 空が許可されている場合は有効とみなす
      onValidationChange(true);
    }
  }, [value, allowEmpty]);

  const validateHotkey = async (hotkey: string) => {
    try {
      const result = await window.electronAPI.validateHotkey(hotkey);
      onValidationChange(result.isValid, result.reason);
    } catch {
      onValidationChange(false, t('hotkeyInput.validationFailed'));
    }
  };

  // ホットキーをクリア
  const handleClear = () => {
    onChange('');
    onValidationChange(true);
  };

  // 入力フィールドクリック時の録画開始
  const startRecording = () => {
    if (disabled) return;
    setIsRecording(true);
    setCurrentKeys(new Set());
    inputRef.current?.focus();
  };

  // 録画中止
  const stopRecording = () => {
    setIsRecording(false);
    setCurrentKeys(new Set());
  };

  // 表示用のテキスト
  const getDisplayText = (): string => {
    if (isRecording) {
      if (currentKeys.size > 0) {
        return Array.from(currentKeys).join(' + ');
      }
      return t('hotkeyInput.pressKeys');
    }
    return value || placeholder;
  };

  return (
    <div className="hotkey-input-container">
      <input
        ref={inputRef}
        type="text"
        className={`hotkey-input ${isRecording ? 'recording' : ''} ${disabled ? 'disabled' : ''}`}
        value={getDisplayText()}
        onClick={startRecording}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={stopRecording}
        readOnly
        disabled={disabled}
        placeholder={placeholder}
      />
      {showClearButton && value && !isRecording && (
        <Button
          variant="cancel"
          size="sm"
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="hotkey-clear-button"
        >
          {t('common.clear')}
        </Button>
      )}
      {isRecording && (
        <div className="hotkey-recording-indicator">
          {t('hotkeyInput.recording')}
          <Button variant="cancel" size="sm" type="button" onClick={stopRecording}>
            {t('common.cancel')}
          </Button>
        </div>
      )}
    </div>
  );
};
