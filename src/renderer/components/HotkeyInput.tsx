import React, { useState, useRef, useEffect } from 'react';
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
  placeholder = 'ホットキーを入力...',
  allowEmpty = false,
  showClearButton = false,
}) => {
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

  // キーボードイベントハンドラ
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isRecording) return;

    event.preventDefault();
    event.stopPropagation();

    const key = normalizeKey(event.key);

    // 修飾キーかチェック
    const modifiers = ['Ctrl', 'Alt', 'Shift', 'CmdOrCtrl'];
    const isModifier = modifiers.includes(key);

    if (isModifier) {
      setCurrentKeys((prev) => new Set([...prev, key]));
    } else if (key.length === 1 && key.match(/[A-Za-z0-9]/)) {
      // 英数字キーの場合
      const upperKey = key.toUpperCase();
      setCurrentKeys((prev) => new Set([...prev, upperKey]));
    } else if (
      ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(key)
    ) {
      // ファンクションキーの場合
      setCurrentKeys((prev) => new Set([...prev, key]));
    } else if (['Space', 'Enter', 'Tab', 'Escape', 'Delete', 'Backspace'].includes(key)) {
      // 特殊キーの場合
      setCurrentKeys((prev) => new Set([...prev, key]));
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isRecording) return;

    event.preventDefault();
    event.stopPropagation();

    // キーが3つ以上組み合わされている場合、ホットキーとして確定
    if (currentKeys.size >= 2) {
      const keysArray = Array.from(currentKeys);
      const modifiers = keysArray.filter((k) => ['Ctrl', 'Alt', 'Shift', 'CmdOrCtrl'].includes(k));
      const nonModifiers = keysArray.filter(
        (k) => !['Ctrl', 'Alt', 'Shift', 'CmdOrCtrl'].includes(k)
      );

      if (modifiers.length > 0 && nonModifiers.length > 0) {
        const hotkey = [...modifiers, ...nonModifiers].join('+');
        onChange(hotkey);
        setIsRecording(false);
        setCurrentKeys(new Set());
        inputRef.current?.blur();
      }
    }
  };

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
      onValidationChange(false, 'ホットキーの検証に失敗しました');
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
      return 'キーを押してください...';
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
          クリア
        </Button>
      )}
      {isRecording && (
        <div className="hotkey-recording-indicator">
          録画中...
          <Button variant="cancel" size="sm" type="button" onClick={stopRecording}>
            キャンセル
          </Button>
        </div>
      )}
    </div>
  );
};
