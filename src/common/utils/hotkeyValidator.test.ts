import { describe, it, expect } from 'vitest';

import { validateHotkey } from './hotkeyValidator';

describe('validateHotkey', () => {
  it('修飾キー 1 つ以上と通常キー 1 つの組み合わせを受け付ける', () => {
    expect(validateHotkey('Alt+Space')).toEqual({ isValid: true });
    expect(validateHotkey('Ctrl+Alt+A')).toEqual({ isValid: true });
    expect(validateHotkey('Ctrl+Shift+F12')).toEqual({ isValid: true });
    expect(validateHotkey('CmdOrCtrl+Q')).toEqual({ isValid: true });
  });

  it('修飾キーが 3 つでも受け付ける（録画で作れる組み合わせ）', () => {
    expect(validateHotkey('Ctrl+Alt+Shift+A')).toEqual({ isValid: true });
  });

  it('空や文字列でない値は「指定されていません」', () => {
    expect(validateHotkey('')).toEqual({
      isValid: false,
      reason: 'ホットキーが指定されていません',
    });
    expect(validateHotkey(undefined)).toEqual({
      isValid: false,
      reason: 'ホットキーが指定されていません',
    });
  });

  it('通常キーが 2 つ以上あると弾く', () => {
    expect(validateHotkey('Ctrl+A+B')).toEqual({
      isValid: false,
      reason: '通常キーは 1 つだけにしてください',
    });
  });

  it('通常キーが無いと弾く', () => {
    expect(validateHotkey('Ctrl+Shift')).toEqual({
      isValid: false,
      reason: '修飾キーのほかに通常キーが 1 つ必要です',
    });
  });

  it('修飾キーが無いと弾く', () => {
    expect(validateHotkey('A')).toEqual({
      isValid: false,
      reason: '修飾キー（Ctrl、Alt、Shift等）が必要です',
    });
  });

  it('知らないキー名・空の区切り・同じ修飾キーの重複は形式エラー', () => {
    const invalidFormat = { isValid: false, reason: 'ホットキーの形式が正しくありません' };
    expect(validateHotkey('Ctrl+PageUp')).toEqual(invalidFormat);
    expect(validateHotkey('Ctrl++A')).toEqual(invalidFormat);
    expect(validateHotkey('Ctrl+a')).toEqual(invalidFormat);
    expect(validateHotkey('Hyper+A')).toEqual(invalidFormat);
    expect(validateHotkey('Ctrl+Ctrl+A')).toEqual(invalidFormat);
  });
});
