import { describe, expect, it } from 'vitest';
import type { RegisterItem } from '@common/types';

import { canTryExecute, isTryExecuteBlocked } from './registerItemExecution';

const base: RegisterItem = {
  displayName: 'テスト',
  path: '',
  type: 'url',
  targetTab: 'datafiles/data.json',
  itemCategory: 'item',
};

describe('canTryExecute', () => {
  it('フォルダ取込は試せない', () => {
    expect(canTryExecute({ ...base, itemCategory: 'dir' })).toBe(false);
  });

  it('クリップボードは試せる', () => {
    expect(canTryExecute({ ...base, itemCategory: 'clipboard' })).toBe(true);
  });

  it('アイテムがなければ試せない', () => {
    expect(canTryExecute(undefined)).toBe(false);
  });
});

describe('isTryExecuteBlocked', () => {
  const clip: RegisterItem = { ...base, itemCategory: 'clipboard', clipboardDataRef: 'a.json' };

  it('保存済みのクリップボードは押せる', () => {
    expect(isTryExecuteBlocked(clip)).toBe(false);
  });

  it('取り込み直したばかり（未保存）のときは押せない', () => {
    expect(isTryExecuteBlocked({ ...clip, clipboardSessionId: 's1' })).toBe(true);
  });

  it('書きかけのテキストがあるときは押せない', () => {
    expect(isTryExecuteBlocked({ ...clip, clipboardText: 'あ' })).toBe(true);
  });

  it('実データの参照がないときは押せない', () => {
    expect(isTryExecuteBlocked({ ...clip, clipboardDataRef: undefined })).toBe(true);
  });

  it('クリップボード以外は押せる', () => {
    expect(isTryExecuteBlocked(base)).toBe(false);
  });
});
