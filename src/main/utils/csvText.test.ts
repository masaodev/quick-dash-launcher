import { describe, expect, it } from 'vitest';

import { decodeCsvText } from './csvText';

describe('decodeCsvText', () => {
  it('UTF-8（BOM 付きも）はそのまま読む', () => {
    expect(decodeCsvText(new TextEncoder().encode('id,名前'))).toBe('id,名前');
  });

  it('UTF-8 として正しくなければ Shift_JIS として読む', () => {
    // 「名前」の Shift_JIS
    const sjis = new Uint8Array([0x69, 0x64, 0x2c, 0x96, 0xbc, 0x91, 0x4f]);
    expect(decodeCsvText(sjis)).toBe('id,名前');
  });
});
