/**
 * ホットキー文字列の検証
 *
 * Electron のアクセラレーターは「修飾キー 1 つ以上 + 通常キーちょうど 1 つ」の形なので、
 * それ以外（通常キーが無い・2 つ以上ある・修飾キーが無い）は登録前に弾く。
 */

const MODIFIER_KEYS = new Set(['Ctrl', 'Alt', 'Shift', 'CmdOrCtrl', 'Command', 'Cmd']);

const KEY_PATTERN = /^(?:[A-Z0-9]|Space|Enter|Tab|Escape|Delete|Backspace|F[1-9]|F1[0-2])$/;

/** 弾いた理由（文言は辞書の hotkey.invalid.*。main の SettingsService.validateHotkey が訳す） */
export type HotkeyInvalidReason = 'missing' | 'format' | 'needKey' | 'needModifier' | 'oneKey';

export interface HotkeyValidationResult {
  isValid: boolean;
  reason?: HotkeyInvalidReason;
}

const INVALID_FORMAT = 'format';

export function validateHotkey(hotkey: unknown): HotkeyValidationResult {
  if (!hotkey || typeof hotkey !== 'string') {
    return { isValid: false, reason: 'missing' };
  }

  const parts = hotkey.split('+');
  if (parts.some((part) => part === '')) {
    return { isValid: false, reason: INVALID_FORMAT };
  }

  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);

  if (MODIFIER_KEYS.has(key)) {
    return { isValid: false, reason: 'needKey' };
  }
  if (!KEY_PATTERN.test(key)) {
    return { isValid: false, reason: INVALID_FORMAT };
  }
  if (modifiers.length === 0) {
    return { isValid: false, reason: 'needModifier' };
  }
  if (modifiers.some((modifier) => KEY_PATTERN.test(modifier))) {
    return { isValid: false, reason: 'oneKey' };
  }
  if (!modifiers.every((modifier) => MODIFIER_KEYS.has(modifier))) {
    return { isValid: false, reason: INVALID_FORMAT };
  }
  if (new Set(modifiers).size !== modifiers.length) {
    return { isValid: false, reason: INVALID_FORMAT };
  }

  return { isValid: true };
}
