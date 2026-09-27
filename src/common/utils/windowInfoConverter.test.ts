import { describe, it, expect } from 'vitest';

import type { WindowInfo } from '../types';

import { windowInfoToWindowItem } from './windowInfoConverter';

const info: WindowInfo = {
  hwnd: 0x1234,
  title: '設計書.docx - Word',
  x: 100,
  y: 200,
  width: 800,
  height: 600,
  processId: 42,
  isVisible: true,
  processName: 'WINWORD.EXE',
  executablePath: 'C:\\Program Files\\Microsoft Office\\WINWORD.EXE',
  icon: 'data:image/png;base64,xxx',
};

describe('windowInfoToWindowItem', () => {
  it('既定はタイトルとプロセス名だけ（hwnd・位置・アイコンは持たない）', () => {
    expect(windowInfoToWindowItem(info)).toEqual({
      type: 'window',
      displayName: '設計書.docx - Word',
      windowTitle: '設計書.docx - Word',
      processName: 'WINWORD.EXE',
    });
  });

  it('includePosition で今の位置・サイズも記録する', () => {
    expect(windowInfoToWindowItem(info, { includePosition: true })).toMatchObject({
      x: 100,
      y: 200,
      width: 800,
      height: 600,
    });
  });

  it('プロセス名がなければ processName を付けない', () => {
    const { processName: _unused, ...withoutProcess } = info;
    const item = windowInfoToWindowItem(withoutProcess);
    expect('processName' in item).toBe(false);
  });

  it('JSON にできる（bigint の hwnd を持ち込まない）', () => {
    const item = windowInfoToWindowItem({ ...info, hwnd: BigInt(1) });
    expect(() => JSON.stringify(item)).not.toThrow();
  });
});
