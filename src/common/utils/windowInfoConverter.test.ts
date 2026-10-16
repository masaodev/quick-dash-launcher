import { describe, it, expect } from 'vitest';

import type { WindowInfo } from '../types';

import { windowInfoToPathlessItem } from './windowInfoConverter';

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
  desktopNumber: 2,
};

describe('windowInfoToPathlessItem', () => {
  it('既定は exe 名とタイトルだけのパスの無い単一アイテム（hwnd・位置・アイコン・exe のパスは持たない）', () => {
    expect(windowInfoToPathlessItem(info)).toEqual({
      type: 'windowSwitch',
      displayName: '設計書.docx - Word',
      path: '',
      window: { processName: 'WINWORD.EXE', title: '設計書.docx - Word' },
    });
  });

  it('includePosition で今の位置・サイズを placement に記録する（仮想デスクトップの番号は既定では記録しない）', () => {
    expect(windowInfoToPathlessItem(info, { includePosition: true }).placement).toEqual({
      x: 100,
      y: 200,
      width: 800,
      height: 600,
    });
  });

  it('仮想デスクトップが 2 つ以上あると渡せば、番号も記録する。最大化中なら state も付ける', () => {
    expect(
      windowInfoToPathlessItem(
        { ...info, windowState: 'maximized' },
        { includePosition: true, desktopCount: 3 }
      ).placement
    ).toEqual({
      x: 100,
      y: 200,
      width: 800,
      height: 600,
      virtualDesktopNumber: 2,
      state: 'maximized',
    });
  });

  it('プロセス名がなければタイトルだけで探す', () => {
    const { processName: _unused, ...withoutProcess } = info;
    expect(windowInfoToPathlessItem(withoutProcess).window).toEqual({
      title: '設計書.docx - Word',
    });
  });

  it('JSON にできる（bigint の hwnd を持ち込まない）', () => {
    const item = windowInfoToPathlessItem({ ...info, hwnd: BigInt(1) });
    expect(() => JSON.stringify(item)).not.toThrow();
  });
});
