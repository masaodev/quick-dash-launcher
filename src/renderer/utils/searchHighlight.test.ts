import { afterEach, describe, it, expect } from 'vitest';

import { setSearchNormalization } from './dataParser';
import { findMatchRanges } from './searchHighlight';

afterEach(() => {
  setSearchNormalization({ ignoreWidth: false, ignoreKana: false });
});

describe('findMatchRanges', () => {
  it('検索語が無ければ何も返さない', () => {
    expect(findMatchRanges('GitHub', '')).toEqual([]);
    expect(findMatchRanges('GitHub', '   ')).toEqual([]);
  });

  it('大文字・小文字を区別せず、当たった範囲を返す', () => {
    expect(findMatchRanges('GitHub Desktop', 'hub')).toEqual([[3, 6]]);
  });

  it('スペース区切りの語はそれぞれの範囲を返し、重なりはまとめる', () => {
    expect(findMatchRanges('goo map', 'map goo')).toEqual([
      [0, 3],
      [4, 7],
    ]);
    expect(findMatchRanges('abcdef', 'abc cde')).toEqual([[0, 5]]);
  });

  it('同じ語が何度も出たら全部返す', () => {
    expect(findMatchRanges('資料 資料', '資料')).toEqual([
      [0, 2],
      [3, 5],
    ]);
  });

  it('記号はそのまま文字として比べる', () => {
    expect(findMatchRanges('C++ (x86)', '(x86)')).toEqual([[4, 9]]);
  });

  it('絵文字（サロゲートペア）の後ろの位置もずれない', () => {
    expect(findMatchRanges('🚀 ロケット', 'ロケ')).toEqual([[3, 5]]);
  });

  it('設定で全角・半角を区別しないときは、全角の名前に半角の語で当たり、元の位置を返す', () => {
    setSearchNormalization({ ignoreWidth: true, ignoreKana: false });
    expect(findMatchRanges('ＡＢＣ全角', 'abc')).toEqual([[0, 3]]);
  });

  it('設定でひらがなとカタカナを区別しないときは、ひらがなの語でカタカナに当たる', () => {
    setSearchNormalization({ ignoreWidth: false, ignoreKana: true });
    expect(findMatchRanges('テストの資料', 'てすと')).toEqual([[0, 3]]);
  });

  it('ウィンドウ検索の先頭の < は語に含めない', () => {
    expect(findMatchRanges('メモ帳 (notepad.exe)', '<note', 'window')).toEqual([[5, 9]]);
  });
});
