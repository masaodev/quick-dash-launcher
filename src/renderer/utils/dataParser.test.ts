import { afterEach, describe, it, expect } from 'vitest';
import type { AppItem, WindowInfo } from '@common/types';

import { filterItems, setSearchMemo, setSearchNormalization } from './dataParser';

function windowItem(title: string, processName?: string): WindowInfo {
  return { hwnd: 1, title, processName } as WindowInfo;
}

describe('filterItems（全角・半角、ひらがな・カタカナを区別しない設定）', () => {
  const item = (displayName: string) => ({ displayName }) as unknown as AppItem;
  const chrome = item('Google Chrome');
  const test = item('テスト手順');
  const fullWidth = item('ＡＢＣ全角');
  const items: AppItem[] = [chrome, test, fullWidth];

  afterEach(() => setSearchNormalization({ ignoreWidth: false, ignoreKana: false }));

  it('既定（どちらもオフ）では今までどおり区別する。大文字・小文字は区別しない', () => {
    expect(filterItems(items, 'ｃｈｒｏｍｅ')).toEqual([]);
    expect(filterItems(items, 'ﾃｽﾄ')).toEqual([]);
    expect(filterItems(items, 'てすと')).toEqual([]);
    expect(filterItems(items, 'CHROME')).toEqual([chrome]);
  });

  it('全角と半角を区別しないと、全角英数・半角カナでも当たる', () => {
    setSearchNormalization({ ignoreWidth: true, ignoreKana: false });
    expect(filterItems(items, 'ｃｈｒｏｍｅ')).toEqual([chrome]);
    expect(filterItems(items, 'ﾃｽﾄ')).toEqual([test]);
    expect(filterItems(items, 'abc')).toEqual([fullWidth]);
    expect(filterItems(items, 'てすと')).toEqual([]);
  });

  it('ひらがなとカタカナを区別しないと、ひらがなでカタカナの名前に当たる', () => {
    setSearchNormalization({ ignoreWidth: false, ignoreKana: true });
    expect(filterItems(items, 'てすと')).toEqual([test]);
    expect(filterItems(items, 'ﾃｽﾄ')).toEqual([]);
  });

  it('両方オンなら半角カナとひらがなもそろう。切り替えるとすぐに効く', () => {
    setSearchNormalization({ ignoreWidth: true, ignoreKana: true });
    expect(filterItems([item('てすと')], 'ﾃｽﾄ')).toHaveLength(1);
    setSearchNormalization({ ignoreWidth: false, ignoreKana: false });
    expect(filterItems(items, 'てすと')).toEqual([]);
  });
});

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

describe('filterItems（メモにも当てる設定）', () => {
  const github = {
    id: 'g1',
    displayName: 'GitHub',
    path: 'https://github.com/masaodev',
    type: 'url',
    memo: '仕事のリポジトリ',
  } as AppItem;
  const notepad = { id: 'n1', displayName: 'メモ帳', path: 'notepad.exe', type: 'app' } as AppItem;

  afterEach(() => setSearchMemo(false));

  it('既定（オフ）では表示名だけで探す', () => {
    expect(filterItems([github, notepad], 'masaodev')).toEqual([]);
    expect(filterItems([github, notepad], '仕事')).toEqual([]);
  });

  it('オンにするとメモにも当たり、表示名とまたがる AND も当たる', () => {
    setSearchMemo(true);
    expect(filterItems([github, notepad], '仕事')).toEqual([github]);
    expect(filterItems([github, notepad], 'github 仕事')).toEqual([github]);
  });

  it('オンでもパス（URL を含む）には当てない', () => {
    setSearchMemo(true);
    expect(filterItems([github, notepad], 'masaodev')).toEqual([]);
    expect(filterItems([github, notepad], 'notepad')).toEqual([]);
  });

  it('切り替えるとすぐに効く（前の結果を覚えたままにしない）', () => {
    expect(filterItems([github], '仕事')).toEqual([]);
    setSearchMemo(true);
    expect(filterItems([github], '仕事')).toEqual([github]);
    setSearchMemo(false);
    expect(filterItems([github], '仕事')).toEqual([]);
  });
});
