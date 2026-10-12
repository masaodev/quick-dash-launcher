import { describe, it, expect } from 'vitest';
import type { AppItem, WindowInfo } from '@common/types';

import { filterItems } from './dataParser';

function windowItem(title: string, processName?: string): WindowInfo {
  return { hwnd: 1, title, processName } as WindowInfo;
}

describe('filterItems（ウィンドウ検索モード）', () => {
  const notepad = windowItem('無題 - メモ帳', 'Notepad.exe');
  const chrome = windowItem('GitHub - Google Chrome', 'chrome.exe');
  const items: AppItem[] = [notepad, chrome];

  it('一覧に表示している exe 名でも当たる', () => {
    expect(filterItems(items, 'notepad', 'window')).toEqual([notepad]);
  });

  it('タイトルと exe 名にまたがる複数キーワードは AND で当たる', () => {
    expect(filterItems(items, 'github chrome.exe', 'window')).toEqual([chrome]);
    expect(filterItems(items, 'メモ帳 chrome', 'window')).toEqual([]);
  });

  it('exe 名が取れないウィンドウはタイトルだけで探す', () => {
    const noProcess = windowItem('タイトルだけ');
    expect(filterItems([noProcess], 'タイトル', 'window')).toEqual([noProcess]);
    expect(filterItems([noProcess], 'exe', 'window')).toEqual([]);
  });
});
