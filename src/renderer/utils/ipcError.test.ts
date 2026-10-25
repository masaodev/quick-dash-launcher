import { describe, expect, it } from 'vitest';

import { ipcErrorMessage } from './ipcError';

describe('ipcErrorMessage', () => {
  it('invoke が付けた前置きを取り、元の文だけを返す', () => {
    const error = new Error(
      "Error invoking remote method 'open-item': Error: ENOENT: no such file or directory"
    );
    expect(ipcErrorMessage(error)).toBe('ENOENT: no such file or directory');
  });

  it('Error 以外の種類の例外でも前置きを取る', () => {
    const error = new Error(
      "Error invoking remote method 'open-item': TypeError: x is not a function"
    );
    expect(ipcErrorMessage(error)).toBe('x is not a function');
  });

  it('前置きが無い文と、Error でない値はそのまま返す', () => {
    expect(ipcErrorMessage(new Error('見つかりません'))).toBe('見つかりません');
    expect(ipcErrorMessage('文字列のエラー')).toBe('文字列のエラー');
  });
});
